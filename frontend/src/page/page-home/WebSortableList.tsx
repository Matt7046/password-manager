import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  FlatListProps,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

type SortableContextValue = {
  enabled: boolean;
  activeKey: string | null;
  coarsePointer: boolean;
  registerHeight: (key: string, height: number) => void;
  beginDrag: (key: string, clientY?: number) => void;
  updateDrag: (translationY: number, clientY: number) => void;
  endDrag: (translationY: number) => void;
  cancelDrag: () => void;
};

const SortableContext = createContext<SortableContextValue | null>(null);

const ActiveTranslateContext = createContext<{
  activeKey: string | null;
  dragY: number;
}>({ activeKey: null, dragY: 0 });

const TOUCH_LONG_PRESS_MS = 280;
const TOUCH_MOVE_CANCEL_PX = 12;
const MOUSE_ACTIVATE_PX = 4;
/** Viewport edge zone (px) that triggers auto-scroll while dragging. */
const AUTOSCROLL_EDGE_PX = 72;
/** Max pixels scrolled per animation frame while in the edge zone. */
const AUTOSCROLL_MAX_SPEED = 18;

function findScrollableDescendant(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null;
  const candidates: HTMLElement[] = [root, ...Array.from(root.querySelectorAll('*'))].filter(
    (n): n is HTMLElement => n instanceof HTMLElement,
  );
  let fallback: HTMLElement | null = null;
  for (const el of candidates) {
    const oy = window.getComputedStyle(el).overflowY;
    if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') continue;
    if (el.scrollHeight > el.clientHeight + 1) return el;
    if (!fallback) fallback = el;
  }
  return fallback;
}

function resolveScrollElement(
  list: FlatList<any> | null,
  container?: HTMLElement | null,
): HTMLElement | null {
  if (Platform.OS !== 'web') return null;
  const anyList = list as any;
  try {
    if (anyList && typeof anyList.getScrollableNode === 'function') {
      const node = anyList.getScrollableNode();
      if (node instanceof HTMLElement) return node;
    }
    const native = anyList?.getNativeScrollRef?.() ?? anyList?.getScrollResponder?.();
    if (native instanceof HTMLElement) return native;
    if (native && typeof native.getScrollableNode === 'function') {
      const node = native.getScrollableNode();
      if (node instanceof HTMLElement) return node;
    }
    const nested =
      native?._component ??
      anyList?._listRef?._scrollRef?._component ??
      anyList?._listRef?._scrollRef;
    if (nested instanceof HTMLElement) return nested;
    if (nested && typeof nested.getScrollableNode === 'function') {
      const node = nested.getScrollableNode();
      if (node instanceof HTMLElement) return node;
    }
  } catch {
    /* ignore */
  }
  return findScrollableDescendant(container ?? null);
}

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(pointer: coarse)');
    const sync = () => setCoarse(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);
  return coarse;
}

function targetIndexForTranslation(
  from: number,
  translationY: number,
  keys: string[],
  heights: Record<string, number>,
) {
  const fallback = 72;
  let origin = 0;
  for (let i = 0; i < from; i++) {
    origin += heights[keys[i]] ?? fallback;
  }
  const fromH = heights[keys[from]] ?? fallback;
  const center = origin + fromH / 2 + translationY;

  let acc = 0;
  for (let i = 0; i < keys.length; i++) {
    const h = heights[keys[i]] ?? fallback;
    if (center < acc + h / 2) return i;
    acc += h;
  }
  return keys.length - 1;
}

export type WebDragHandleProps = {
  children?: React.ReactNode;
  style?: object;
  /**
   * true (default): touch-action none — for the ≡ handle.
   * false: pan-y until long-press activates — card body can scroll the list on mobile.
   */
  captureTouch?: boolean;
};

type WebSortableListProps<T> = {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (info: {
    item: T;
    index: number;
    isActive: boolean;
    DragHandle: React.ComponentType<WebDragHandleProps>;
  }) => React.ReactElement | null;
  onDragEnd: (data: T[]) => void;
  enabled: boolean;
  onDraggingChange?: (dragging: boolean) => void;
} & Omit<
  FlatListProps<T>,
  'data' | 'renderItem' | 'keyExtractor' | 'CellRendererComponent'
>;

function flattenStyle(style: object | object[] | undefined): Record<string, unknown> {
  if (!style) return {};
  const flat: Record<string, unknown> = { ...(StyleSheet.flatten(style as any) || {}) };
  // Raw DOM divs don't understand RN's `flex: n` the same way Views do.
  if (typeof flat.flex === 'number') {
    flat.flexGrow = flat.flex;
    flat.flexShrink = 1;
    flat.flexBasis = '0%';
    delete flat.flex;
  }
  if (flat.flexDirection || flat.flexGrow != null) {
    flat.minWidth = flat.minWidth ?? 0;
  }
  return flat;
}

function DragHandleInner({
  itemKey,
  children,
  style,
  captureTouch = true,
}: {
  itemKey: string;
  children?: React.ReactNode;
  style?: object;
  captureTouch?: boolean;
}) {
  const ctx = useContext(SortableContext);
  const enabled = !!ctx?.enabled;
  const coarsePointer = !!ctx?.coarsePointer;
  const startYRef = useRef(0);
  const activatedRef = useRef(false);
  const trackingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const targetRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const activate = useCallback((clientY?: number) => {
    if (!ctx || activatedRef.current) return;
    activatedRef.current = true;
    ctx.beginDrag(itemKey, clientY ?? startYRef.current);
    // Capture only after long-press so pan-y scroll still works before activation.
    if (!captureTouch && targetRef.current != null && pointerIdRef.current != null) {
      try {
        targetRef.current.setPointerCapture?.(pointerIdRef.current);
      } catch {
        /* ignore */
      }
    }
    if (coarsePointer && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(12);
      } catch {
        /* ignore */
      }
    }
  }, [captureTouch, coarsePointer, ctx, itemKey]);

  const onPointerDown = useCallback(
    (e: any) => {
      if (!ctx || !enabled) return;
      if (e.button != null && e.button !== 0) return;

      const clientY = e.clientY ?? e.nativeEvent?.pageY ?? 0;
      startYRef.current = clientY;
      activatedRef.current = false;
      trackingRef.current = true;
      pointerIdRef.current = e.pointerId ?? null;
      targetRef.current = e.currentTarget;

      // Capture immediately only on the ≡ handle; card body must allow list scroll.
      if (captureTouch) {
        try {
          e.currentTarget?.setPointerCapture?.(e.pointerId);
        } catch {
          /* ignore */
        }
      }

      clearTimer();
      if (coarsePointer) {
        timerRef.current = setTimeout(() => {
          activate(startYRef.current);
        }, TOUCH_LONG_PRESS_MS);
      }
    },
    [activate, captureTouch, clearTimer, coarsePointer, ctx, enabled],
  );

  const onPointerMove = useCallback(
    (e: any) => {
      if (!ctx || !enabled || !trackingRef.current) return;
      const clientY = e.clientY ?? e.nativeEvent?.pageY ?? 0;
      const dy = clientY - startYRef.current;

      if (!activatedRef.current) {
        if (coarsePointer) {
          if (Math.abs(dy) > TOUCH_MOVE_CANCEL_PX) {
            clearTimer();
            trackingRef.current = false;
            try {
              e.currentTarget?.releasePointerCapture?.(e.pointerId);
            } catch {
              /* ignore */
            }
          }
          return;
        }
        // Mouse / fine pointer: start drag after a small move (desktop onPressIn feel).
        if (Math.abs(dy) >= MOUSE_ACTIVATE_PX) {
          activate(clientY);
        } else {
          return;
        }
      }

      e.preventDefault?.();
      ctx.updateDrag(dy, clientY);
    },
    [activate, clearTimer, coarsePointer, ctx, enabled],
  );

  const finishPointer = useCallback(
    (e: any) => {
      if (!ctx || !enabled) return;
      const clientY = e.clientY ?? e.nativeEvent?.pageY ?? startYRef.current;
      const dy = clientY - startYRef.current;
      const wasActive = activatedRef.current;

      clearTimer();
      activatedRef.current = false;
      trackingRef.current = false;
      pointerIdRef.current = null;
      targetRef.current = null;

      try {
        e.currentTarget?.releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }

      if (wasActive) {
        ctx.endDrag(dy);
      } else {
        ctx.cancelDrag();
      }
    },
    [clearTimer, ctx, enabled],
  );

  useEffect(() => () => clearTimer(), [clearTimer]);

  if (!ctx || !enabled) {
    return <View style={style}>{children}</View>;
  }

  // Real DOM node: RN-web View often loses pointer events inside FlatList on mobile Safari/PWA.
  if (Platform.OS === 'web') {
    const flattened = flattenStyle(style);
    const isHandle = captureTouch;
    return React.createElement(
      'div',
      {
        className: isHandle ? 'reorder-drag-target' : 'reorder-drag-surface',
        style: {
          ...(isHandle
            ? {
                paddingRight: 12,
                paddingTop: 12,
                paddingBottom: 12,
                paddingLeft: 4,
                minWidth: 44,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }
            : null),
          ...flattened,
          display: 'flex',
          boxSizing: 'border-box',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          // Handle blocks scroll; card body keeps pan-y so the list can scroll on mobile.
          touchAction: isHandle ? 'none' : 'pan-y',
          cursor: 'grab',
        },
        onPointerDown,
        onPointerMove,
        onPointerUp: finishPointer,
        onPointerCancel: finishPointer,
        onContextMenu: (ev: any) => {
          ev?.preventDefault?.();
          ev?.stopPropagation?.();
        },
      },
      children,
    );
  }

  return <View style={style}>{children}</View>;
}

function ActiveTranslateWrap({
  itemKey,
  children,
}: {
  itemKey: string;
  children: React.ReactNode;
}) {
  const { activeKey, dragY } = useContext(ActiveTranslateContext);
  const isActive = activeKey === itemKey;
  return (
    <View
      style={
        isActive
          ? {
              transform: [{ translateY: dragY }],
              zIndex: 30,
              elevation: 8,
              shadowColor: '#000',
              shadowOpacity: 0.35,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
            }
          : undefined
      }
      pointerEvents={activeKey && !isActive ? 'none' : 'auto'}
    >
      {children}
    </View>
  );
}

function SortableRow<T>({
  item,
  index,
  itemKey,
  renderItem,
}: {
  item: T;
  index: number;
  itemKey: string;
  renderItem: WebSortableListProps<T>['renderItem'];
}) {
  const ctx = useContext(SortableContext);
  const isActive = ctx?.activeKey === itemKey;

  const DragHandle = useMemo(() => {
    const Handle = (props: WebDragHandleProps) => (
      <DragHandleInner
        itemKey={itemKey}
        style={props.style}
        captureTouch={props.captureTouch !== false}
      >
        {props.children}
      </DragHandleInner>
    );
    Handle.displayName = 'WebDragHandle';
    return Handle;
  }, [itemKey]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      ctx?.registerHeight(itemKey, e.nativeEvent.layout.height);
    },
    [ctx, itemKey],
  );

  return (
    <View
      onLayout={onLayout}
      style={{
        zIndex: isActive ? 20 : 1,
        opacity: isActive ? 0.96 : 1,
        transform: isActive ? [{ scale: 1.03 }] : undefined,
      }}
    >
      <ActiveTranslateWrap itemKey={itemKey}>
        {renderItem({ item, index, isActive: !!isActive, DragHandle })}
      </ActiveTranslateWrap>
    </View>
  );
}

export default function WebSortableList<T>({
  data,
  keyExtractor,
  renderItem,
  onDragEnd,
  enabled,
  onDraggingChange,
  ...flatListProps
}: WebSortableListProps<T>) {
  const coarsePointer = useCoarsePointer();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [dragY, setDragY] = useState(0);
  const heightsRef = useRef<Record<string, number>>({});
  const dataRef = useRef(data);
  dataRef.current = data;
  const activeKeyRef = useRef<string | null>(null);
  const draggingRef = useRef(false);
  const listRef = useRef<FlatList<T>>(null);
  const containerDomRef = useRef<HTMLElement | null>(null);
  const scrollOffsetRef = useRef(0);
  const dragStartScrollRef = useRef(0);
  const pointerTranslationRef = useRef(0);
  const pointerClientYRef = useRef(0);
  const autoScrollRafRef = useRef<number | null>(null);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current != null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  }, []);

  const applyDragY = useCallback(() => {
    const scrolled = scrollOffsetRef.current - dragStartScrollRef.current;
    setDragY(pointerTranslationRef.current + scrolled);
  }, []);

  const autoScrollTick = useCallback(() => {
    autoScrollRafRef.current = null;
    if (!draggingRef.current) return;

    const el = resolveScrollElement(listRef.current, containerDomRef.current);
    if (el) {
      const rect = el.getBoundingClientRect();
      const y = pointerClientYRef.current;
      let delta = 0;

      if (y < rect.top + AUTOSCROLL_EDGE_PX) {
        const intensity = Math.min(1, (rect.top + AUTOSCROLL_EDGE_PX - y) / AUTOSCROLL_EDGE_PX);
        delta = -Math.ceil(AUTOSCROLL_MAX_SPEED * intensity);
      } else if (y > rect.bottom - AUTOSCROLL_EDGE_PX) {
        const intensity = Math.min(
          1,
          (y - (rect.bottom - AUTOSCROLL_EDGE_PX)) / AUTOSCROLL_EDGE_PX,
        );
        delta = Math.ceil(AUTOSCROLL_MAX_SPEED * intensity);
      }

      if (delta !== 0) {
        const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
        const next = Math.max(0, Math.min(maxScroll, el.scrollTop + delta));
        if (next !== el.scrollTop) {
          el.scrollTop = next;
          scrollOffsetRef.current = next;
          applyDragY();
        }
      }
    }

    if (draggingRef.current) {
      autoScrollRafRef.current = requestAnimationFrame(autoScrollTick);
    }
  }, [applyDragY]);

  const ensureAutoScroll = useCallback(() => {
    if (Platform.OS !== 'web') return;
    if (autoScrollRafRef.current != null) return;
    if (!draggingRef.current) return;
    autoScrollRafRef.current = requestAnimationFrame(autoScrollTick);
  }, [autoScrollTick]);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    const prevent = (e: Event) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', prevent, true);
    document.addEventListener('selectstart', prevent, true);
    return () => {
      document.removeEventListener('contextmenu', prevent, true);
      document.removeEventListener('selectstart', prevent, true);
    };
  }, [enabled]);

  useEffect(() => () => stopAutoScroll(), [stopAutoScroll]);

  // Entering/leaving reorder remounts row chrome and RN-web often resets scroll to 0.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    const y = scrollOffsetRef.current;
    if (y <= 0) return;
    const restore = () => {
      try {
        listRef.current?.scrollToOffset?.({ offset: y, animated: false });
      } catch {
        /* ignore */
      }
      const el = resolveScrollElement(listRef.current, containerDomRef.current);
      if (el) el.scrollTop = y;
    };
    restore();
    const id = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(id);
  }, [enabled]);

  const registerHeight = useCallback((key: string, height: number) => {
    heightsRef.current[key] = height;
  }, []);

  const beginDrag = useCallback(
    (key: string, clientY?: number) => {
      draggingRef.current = true;
      activeKeyRef.current = key;
      const el = resolveScrollElement(listRef.current, containerDomRef.current);
      scrollOffsetRef.current = el?.scrollTop ?? scrollOffsetRef.current;
      dragStartScrollRef.current = scrollOffsetRef.current;
      pointerTranslationRef.current = 0;
      if (typeof clientY === 'number') {
        pointerClientYRef.current = clientY;
      }
      setActiveKey(key);
      setDragY(0);
      onDraggingChange?.(true);
      ensureAutoScroll();
    },
    [ensureAutoScroll, onDraggingChange],
  );

  const updateDrag = useCallback(
    (translationY: number, clientY: number) => {
      pointerTranslationRef.current = translationY;
      pointerClientYRef.current = clientY;
      applyDragY();
      ensureAutoScroll();
    },
    [applyDragY, ensureAutoScroll],
  );

  const finishDrag = useCallback(
    (translationY: number | null) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      stopAutoScroll();
      const key = activeKeyRef.current;
      activeKeyRef.current = null;
      const scrolled = scrollOffsetRef.current - dragStartScrollRef.current;
      const effectiveY =
        translationY === null ? null : translationY + scrolled;
      setActiveKey(null);
      setDragY(0);
      pointerTranslationRef.current = 0;
      onDraggingChange?.(false);
      if (!key || effectiveY === null) return;

      const list = dataRef.current;
      const keys = list.map((item, i) => keyExtractor(item, i));
      const from = keys.indexOf(key);
      if (from < 0) return;

      const to = targetIndexForTranslation(
        from,
        effectiveY,
        keys,
        heightsRef.current,
      );
      if (to === from) return;

      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onDragEnd(next);
    },
    [keyExtractor, onDragEnd, onDraggingChange, stopAutoScroll],
  );

  const endDrag = useCallback(
    (translationY: number) => {
      finishDrag(translationY);
    },
    [finishDrag],
  );

  const cancelDrag = useCallback(() => {
    finishDrag(null);
  }, [finishDrag]);

  const ctxValue = useMemo<SortableContextValue>(
    () => ({
      enabled,
      activeKey,
      coarsePointer,
      registerHeight,
      beginDrag,
      updateDrag,
      endDrag,
      cancelDrag,
    }),
    [
      enabled,
      activeKey,
      coarsePointer,
      registerHeight,
      beginDrag,
      updateDrag,
      endDrag,
      cancelDrag,
    ],
  );

  const renderRow = useCallback(
    ({ item, index }: { item: T; index: number }) => {
      const itemKey = keyExtractor(item, index);
      return (
        <SortableRow
          item={item}
          index={index}
          itemKey={itemKey}
          renderItem={renderItem}
        />
      );
    },
    [keyExtractor, renderItem],
  );

  const list = (
    <FlatList
      {...flatListProps}
      ref={listRef}
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderRow}
      scrollEnabled={flatListProps.scrollEnabled !== false}
      removeClippedSubviews={false}
      onScroll={(e) => {
        scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        if (draggingRef.current) applyDragY();
        flatListProps.onScroll?.(e);
      }}
      scrollEventThrottle={flatListProps.scrollEventThrottle ?? 16}
    />
  );

  return (
    <SortableContext.Provider value={ctxValue}>
      <ActiveTranslateContext.Provider value={{ activeKey, dragY }}>
        {Platform.OS === 'web'
          ? React.createElement(
              'div',
              {
                ref: (node: HTMLElement | null) => {
                  containerDomRef.current = node;
                },
                style: {
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  height: '100%',
                },
              },
              list,
            )
          : list}
      </ActiveTranslateContext.Provider>
    </SortableContext.Provider>
  );
}
