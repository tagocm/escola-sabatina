import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("account review screen communicates the temporary security hold", () => {
  const source = readSource("app/(auth)/conta-em-averiguacao/page.tsx");

  assert.match(source, /Conta suspensa/);
  assert.match(source, /para averigua[cç][aã]o/);
  assert.match(source, /Seus dados permanecem preservados/);
  assert.match(source, /Sair do sistema/);
});

test("the reviewed account is routed to the warning after sign-in", () => {
  const loginSource = readSource("app/(auth)/login/page.tsx");
  const authSource = readSource("app/actions/auth.ts");

  assert.match(authSource, /accountUnderReview/);
  assert.match(loginSource, /\/conta-em-averiguacao/);
});
