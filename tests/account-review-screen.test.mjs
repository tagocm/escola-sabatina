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
  assert.doesNotMatch(source, /Ana Paula Lopes/i);
});

test("the reviewed account is routed to the warning after sign-in", () => {
  const loginSource = readSource("app/(auth)/login/page.tsx");
  const authSource = readSource("app/actions/auth.ts");

  assert.match(authSource, /accountUnderReview/);
  assert.match(loginSource, /\/conta-em-averiguacao/);
});

test("restored teacher accounts are no longer under review", () => {
  const reviewSource = readSource("lib/auth/account-review.ts");
  const migrationSource = readSource(
    "supabase/migrations/20260822134456_restore_ana_paula_teacher_account_access.sql",
  );

  assert.match(reviewSource, /new Set<string>\(\)/);
  assert.match(migrationSource, /SELECT FALSE;/);

  for (const restoredOrRelatedAccountId of [
    "51cc1e11-a35d-4bf3-aa62-78974accb2cb",
    "5b93da5f-9d96-4f58-9d18-5d26d89bf409",
    "76e5f97d-7c62-42cd-8937-434c1fc9750c",
    "237e0163-0204-4c1a-bf01-d338b310e044",
  ]) {
    assert.doesNotMatch(reviewSource, new RegExp(restoredOrRelatedAccountId));
    assert.doesNotMatch(migrationSource, new RegExp(restoredOrRelatedAccountId));
  }
});
