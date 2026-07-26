/**
 * Expo `export --platform web` (single) often ignores app/+html.tsx.
 * Inject PWA meta/links into dist/index.html after export.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(root, "..", "dist", "index.html");

if (!fs.existsSync(indexPath)) {
  console.warn("[patch-web-html] dist/index.html not found, skip");
  process.exit(0);
}

let html = fs.readFileSync(indexPath, "utf8");

const inject = `
    <meta name="theme-color" content="#1a1a2e" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
`;

if (html.includes('rel="manifest"')) {
  console.log("[patch-web-html] manifest already present");
  process.exit(0);
}

html = html.replace(/<html[^>]*>/i, '<html lang="it">');
html = html.replace(/<title>[^<]*<\/title>/i, (m) => `${m}${inject}`);
html = html.replace(
  /href="\/favicon\.ico"/i,
  'href="/favicon.png"',
);

fs.writeFileSync(indexPath, html);
console.log("[patch-web-html] injected PWA tags into dist/index.html");
