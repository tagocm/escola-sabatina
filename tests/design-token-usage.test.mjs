import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const scanRoots = ["app", "components"];
const scannedExtensions = new Set([".css", ".ts", ".tsx"]);
const tokenSourceFiles = new Set(["app/globals.css", "components/ui/design-tokens.ts"]);

const forbiddenPatterns = [
  {
    name: "hardcoded color literal",
    pattern: /#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(/,
  },
  {
    name: "arbitrary color utility",
    pattern: /\b(?:bg|text|border|ring|fill|stroke)-\[#/,
  },
  {
    name: "raw palette utility",
    pattern: /\b(?:bg|text|border|ring|fill|stroke)-(?:white|black|red-\d{2,3}|green-\d{2,3}|blue-\d{2,3}|yellow-\d{2,3}|orange-\d{2,3}|slate-\d{2,3}|gray-\d{2,3}|zinc-\d{2,3}|neutral-\d{2,3}|stone-\d{2,3})\b/,
  },
];

function collectFiles(dir) {
  const entries = readdirSync(dir);
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      files.push(...collectFiles(fullPath));
      continue;
    }

    const extension = fullPath.slice(fullPath.lastIndexOf("."));
    if (scannedExtensions.has(extension)) files.push(fullPath);
  }

  return files;
}

test("app UI files use semantic tokens instead of raw colors", () => {
  const violations = [];

  for (const scanRoot of scanRoots) {
    for (const filePath of collectFiles(join(root, scanRoot))) {
      const relativePath = relative(root, filePath);
      if (tokenSourceFiles.has(relativePath)) continue;

      const lines = readFileSync(filePath, "utf8").split("\n");
      lines.forEach((line, index) => {
        for (const { name, pattern } of forbiddenPatterns) {
          if (pattern.test(line)) {
            violations.push(`${relativePath}:${index + 1} uses ${name}: ${line.trim()}`);
          }
        }
      });
    }
  }

  assert.deepEqual(violations, []);
});
