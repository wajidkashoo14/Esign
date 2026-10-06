import { readFile } from "node:fs/promises";
import path from "node:path";

// Noto Sans (Latin, Greek, Cyrillic, ₹ ...) and Noto Sans Devanagari, SIL Open Font
// License (assets/fonts/OFL.txt). Shipped with the serverless functions via
// outputFileTracingIncludes in next.config.ts.
const FILES = {
  regular: "NotoSans-Regular.ttf",
  bold: "NotoSans-Bold.ttf",
  devaRegular: "NotoSansDevanagari-Regular.ttf",
  devaBold: "NotoSansDevanagari-Bold.ttf",
} as const;

export type FontKey = keyof typeof FILES;
export type FontFiles = Record<FontKey, Uint8Array>;

let cache: Promise<FontFiles> | undefined;

export function loadFontFiles(): Promise<FontFiles> {
  cache ??= (async () => {
    const dir = path.join(process.cwd(), "assets", "fonts");
    const entries = await Promise.all(
      (Object.keys(FILES) as FontKey[]).map(async (k) => [k, new Uint8Array(await readFile(path.join(dir, FILES[k])))] as const),
    );
    return Object.fromEntries(entries) as FontFiles;
  })().catch((err) => {
    cache = undefined; // retry on the next call
    throw err;
  });
  return cache;
}
