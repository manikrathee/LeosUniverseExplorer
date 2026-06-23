import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const files = [
  "index.html",
  "styles.css",
  "app.js",
  "universe-render.js",
  "universe-sim.js",
  "utils.js"
];

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

for (const file of files) {
  const from = path.join(rootDir, file);
  const to = path.join(distDir, file);
  if (!fs.existsSync(from)) {
    throw new Error(`Missing required file: ${file}`);
  }
  fs.copyFileSync(from, to);
}

console.log(`Built ${files.length} files into dist/`);
