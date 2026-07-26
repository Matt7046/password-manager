/**
 * Genera logo Password Manager (icona colorsdev + testo "password-manager")
 * e relative icone PWA / favicon / splash Expo — sfondo trasparente.
 *
 * Sorgente icona: public/logo-colorsdev-v2.png (solo il mark, senza ".tech")
 * Uso: node scripts/generate-pwa-assets.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const pwaDir = path.join(publicDir, "pwa");
const assetsImagesDir = path.join(__dirname, "..", "assets", "images");
const brandLogoPath = path.join(publicDir, "logo-colorsdev-v2.png");
const appLogoPath = path.join(publicDir, "logo-password-manager.png");

const LABEL = "password-manager";

/** Loghi Expo template React da rimuovere. */
const REACT_TEMPLATE_ICONS = [
  "partial-react-logo.png",
  "react-logo.png",
  "react-logo@2x.png",
  "react-logo@3x.png",
];

const ensureBrandLogo = async () => {
  try {
    await fs.access(brandLogoPath);
  } catch {
    console.warn(
      "[pwa] logo-colorsdev-v2.png non trovato in public/. Copialo da Activity Manager.",
    );
    process.exit(0);
  }
};

/** Trova la fine del mark (prima del gap sopra il testo ".tech"). */
const findMarkBottom = async () => {
  const { data, info } = await sharp(brandLogoPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const rowHas = [];
  for (let y = 0; y < height; y++) {
    let hit = false;
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] > 20) {
        hit = true;
        break;
      }
    }
    rowHas.push(hit);
  }
  const bands = [];
  let start = null;
  for (let y = 0; y <= height; y++) {
    const on = y < height && rowHas[y];
    if (on && start === null) start = y;
    if (!on && start !== null) {
      bands.push([start, y - 1]);
      start = null;
    }
  }
  if (!bands.length) {
    throw new Error("Nessun contenuto nel logo colorsdev");
  }
  const markEnd = bands[0][1];
  return Math.min(height, markEnd + 8);
};

/** Ritaglia solo il mark cd (senza la riga ".tech"). */
const extractMark = async () => {
  const meta = await sharp(brandLogoPath).metadata();
  const width = meta.width;
  const height = meta.height;
  if (!width || !height) {
    throw new Error("logo-colorsdev-v2.png senza dimensioni");
  }
  const cropHeight = await findMarkBottom();
  const cropped = await sharp(brandLogoPath)
    .ensureAlpha()
    .extract({ left: 0, top: 0, width, height: cropHeight })
    .png()
    .toBuffer();
  return sharp(cropped).trim({ threshold: 10 }).png().toBuffer();
};

/** Composito mark + "password-manager" su canvas trasparente. */
const buildAppLogo = async () => {
  const markBuf = await extractMark();
  const markMeta = await sharp(markBuf).metadata();
  const markW = markMeta.width ?? 700;
  const markH = markMeta.height ?? 220;

  const canvasW = Math.max(920, Math.ceil(markW * 1.15));
  const markTargetW = Math.min(markW, Math.floor(canvasW * 0.72));
  const markTargetH = Math.round((markH / markW) * markTargetW);
  const markScaled = await sharp(markBuf)
    .resize(markTargetW, markTargetH, { fit: "inside" })
    .png()
    .toBuffer();

  const fontSize = 52;
  const textGap = 28;
  const padTop = 24;
  const padBottom = 36;
  const canvasH = padTop + markTargetH + textGap + fontSize + padBottom;

  const textSvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${canvasW}" height="${fontSize + 16}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4ecdc4"/>
      <stop offset="45%" stop-color="#5b7cfa"/>
      <stop offset="100%" stop-color="#e040a0"/>
    </linearGradient>
  </defs>
  <text
    x="50%"
    y="72%"
    text-anchor="middle"
    font-family="Segoe UI, Arial, Helvetica, sans-serif"
    font-size="${fontSize}"
    font-weight="600"
    letter-spacing="0.5"
    fill="url(#g)"
  >${LABEL}</text>
</svg>`);

  const textPng = await sharp(textSvg).png().toBuffer();

  await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: markScaled,
        top: padTop,
        left: Math.round((canvasW - markTargetW) / 2),
      },
      {
        input: textPng,
        top: padTop + markTargetH + textGap,
        left: 0,
      },
    ])
    .png()
    .toFile(appLogoPath);

  console.log(`[pwa] Creato ${path.basename(appLogoPath)}`);
};

/** Canvas quadrato: logo con letterbox trasparente. */
const resizeContainedSquare = (size) =>
  sharp(appLogoPath)
    .ensureAlpha()
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png();

const screenshot = async (fileName, canvasW, canvasH) => {
  const logoBuf = await sharp(appLogoPath)
    .ensureAlpha()
    .resize(canvasW, canvasH, {
      fit: "inside",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logoBuf, gravity: "center" }])
    .png()
    .toFile(path.join(pwaDir, fileName));
};

/** Icone Expo / EAS in assets/images (sostituisce template Emergent/React). */
const writeExpoAssets = async () => {
  await fs.mkdir(assetsImagesDir, { recursive: true });

  await resizeContainedSquare(1024).toFile(path.join(assetsImagesDir, "icon.png"));
  await resizeContainedSquare(1024).toFile(path.join(assetsImagesDir, "adaptive-icon.png"));
  await resizeContainedSquare(1024).toFile(path.join(assetsImagesDir, "splash-image.png"));
  await resizeContainedSquare(1024).toFile(path.join(assetsImagesDir, "app-image.png"));
  await resizeContainedSquare(48).toFile(path.join(assetsImagesDir, "favicon.png"));

  for (const name of REACT_TEMPLATE_ICONS) {
    const p = path.join(assetsImagesDir, name);
    try {
      await fs.unlink(p);
      console.log(`[pwa] Rimosso template React: ${name}`);
    } catch {
      /* già assente */
    }
  }

  console.log("[pwa] Asset Expo aggiornati in assets/images/");
};

const main = async () => {
  await ensureBrandLogo();
  await fs.mkdir(pwaDir, { recursive: true });
  await buildAppLogo();

  await resizeContainedSquare(192).toFile(path.join(pwaDir, "icon-192.png"));
  await resizeContainedSquare(512).toFile(path.join(pwaDir, "icon-512.png"));
  await resizeContainedSquare(192).toFile(path.join(pwaDir, "icon-maskable-192.png"));
  await resizeContainedSquare(512).toFile(path.join(pwaDir, "icon-maskable-512.png"));

  await resizeContainedSquare(128).toFile(path.join(publicDir, "favicon.png"));
  await resizeContainedSquare(180).toFile(path.join(publicDir, "apple-touch-icon.png"));

  // Edge/Chrome richiedono /favicon.ico reale (non PNG rinominato)
  const { default: pngToIco } = await import("png-to-ico");
  const icoPng32 = await sharp(appLogoPath)
    .ensureAlpha()
    .resize(32, 32, {
      fit: "contain",
      background: { r: 26, g: 26, b: 46, alpha: 1 },
    })
    .png()
    .toBuffer();
  const icoPng16 = await sharp(appLogoPath)
    .ensureAlpha()
    .resize(16, 16, {
      fit: "contain",
      background: { r: 26, g: 26, b: 46, alpha: 1 },
    })
    .png()
    .toBuffer();
  const icoBuf = await pngToIco([icoPng16, icoPng32]);
  await fs.writeFile(path.join(publicDir, "favicon.ico"), icoBuf);

  await screenshot("screenshot-wide.png", 1280, 720);
  await screenshot("screenshot-narrow.png", 390, 844);

  await writeExpoAssets();

  console.log("[pwa] Asset generati da logo-password-manager.png (PWA + Expo).");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
