import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../components/ui/design-tokens.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const { designTokens } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("design tokens expose primitive, semantic and component layers", () => {
  assert.ok(designTokens.primitive.color.brand.orange.$value);
  assert.ok(designTokens.primitive.color.neutral.patternPaper.$value);
  assert.ok(designTokens.semantic.color.background.$value);
  assert.ok(designTokens.semantic.color.surfacePattern.$value);
  assert.ok(designTokens.semantic.color.chartGrid.$value);
  assert.ok(designTokens.component.button.primary.className);
  assert.ok(designTokens.component.polaroid.tile.className);
});

test("design tokens define mobile operational app accessibility baselines", () => {
  assert.equal(designTokens.component.interactive.target.minHeight.$value, "44px");
  assert.equal(designTokens.semantic.focus.ringWidth.$value, "4px");
  assert.equal(designTokens.primitive.letterSpacing.none.$value, "0");
});
