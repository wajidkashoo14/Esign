// One-off: shrink the Latin PDF fonts to the characters agreements need.
// Usage: node scripts/subset-fonts.mjs <NotoSans-Regular.ttf> <NotoSans-Bold.ttf>
// Writes assets/fonts/NotoSans-{Regular,Bold}.ttf. (pdf-lib's own subsetting
// drops glyphs from Noto Sans, so the PDFs embed these pre-subset files whole.)
import { readFileSync, writeFileSync } from "node:fs";
import subsetFont from "subset-font";

const ranges = [
  [0x20, 0x7e], // Basic Latin
  [0xa0, 0x17f], // Latin-1 Supplement, Latin Extended-A
  [0x2010, 0x2027], // dashes, quotes, bullets, ellipsis
  [0x2030, 0x203a],
  [0x20a8, 0x20b9], // currency signs incl. ₹
  [0x20ac, 0x20ac],
  [0x2116, 0x2116],
  [0x2122, 0x2122],
];
const text = ranges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i))).join("");

const [regular, bold] = process.argv.slice(2);
if (!regular || !bold) {
  console.error("Usage: node scripts/subset-fonts.mjs <NotoSans-Regular.ttf> <NotoSans-Bold.ttf>");
  process.exit(1);
}
for (const [src, name] of [
  [regular, "NotoSans-Regular.ttf"],
  [bold, "NotoSans-Bold.ttf"],
]) {
  const out = await subsetFont(readFileSync(src), text, { targetFormat: "truetype" });
  writeFileSync(`assets/fonts/${name}`, out);
  console.log(`${name}: ${out.length} bytes`);
}
