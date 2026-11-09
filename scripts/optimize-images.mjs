// Resizes source photos for the web and writes tiny blur placeholders.
// Usage: node scripts/optimize-images.mjs <source-dir>
import sharp from "sharp";
import { readdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

const src = process.argv[2];
if (!src) throw new Error("Pass the source photo directory");
const out = path.resolve("public/images");
const blur = {};
for (const f of (await readdir(src)).filter((f) => f.endsWith(".jpg"))) {
  const slot = f.replace(/\.jpg$/, "");
  const input = await readFile(path.join(src, f));
  await sharp(input).rotate().resize({ width: 1920, withoutEnlargement: true })
    .jpeg({ quality: 76, progressive: true, mozjpeg: true }).toFile(path.join(out, `${slot}.jpg`));
  const tiny = await sharp(input).resize(16).jpeg({ quality: 40 }).toBuffer();
  blur[`/images/${slot}.jpg`] = `data:image/jpeg;base64,${tiny.toString("base64")}`;
  console.log(slot);
}
await writeFile("src/data/blur.json", JSON.stringify(blur, null, 2));
