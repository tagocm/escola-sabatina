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

test("the restored Tiago account is no longer under review", () => {
  const reviewSource = readSource("lib/auth/account-review.ts");
  const migrationSource = readSource(
    "supabase/migrations/20260822120338_restore_tiago_teacher_account_access.sql",
  );

  const remainingReviewedTeacherId = "51cc1e11-a35d-4bf3-aa62-78974accb2cb";
  const restoredTiagoTeacherId = "5b93da5f-9d96-4f58-9d18-5d26d89bf409";

  assert.match(reviewSource, new RegExp(remainingReviewedTeacherId));
  assert.match(migrationSource, new RegExp(remainingReviewedTeacherId));
  assert.doesNotMatch(reviewSource, new RegExp(restoredTiagoTeacherId));
  assert.doesNotMatch(migrationSource, new RegExp(restoredTiagoTeacherId));

  for (const guardianId of [
    "76e5f97d-7c62-42cd-8937-434c1fc9750c",
    "237e0163-0204-4c1a-bf01-d338b310e044",
  ]) {
    assert.doesNotMatch(reviewSource, new RegExp(guardianId));
    assert.doesNotMatch(migrationSource, new RegExp(guardianId));
  }
});
