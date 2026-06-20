import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const loginSource = readFileSync(new URL("../app/(auth)/login/page.tsx", import.meta.url), "utf8");
const authActionSource = readFileSync(new URL("../app/actions/auth.ts", import.meta.url), "utf8");

function getInputSource(id) {
  const inputs = loginSource.match(/<input[\s\S]*?\n\s*\/>/g) || [];
  const input = inputs.find((candidate) => candidate.includes(`id="${id}"`));
  assert.ok(input, `input ${id} should exist`);
  return input;
}

test("login inputs do not visually uppercase credentials", () => {
  const emailInput = getInputSource("email");
  const passwordInput = getInputSource("password");

  assert.doesNotMatch(emailInput, /\buppercase\b/, "email input should show the typed casing");
  assert.doesNotMatch(passwordInput, /\buppercase\b/, "password input should not transform visible characters");
  assert.match(emailInput, /autoCapitalize="none"/, "email input should disable mobile auto-capitalization");
  assert.match(emailInput, /autoComplete="email"/, "email input should expose the email autocomplete hint");
  assert.match(passwordInput, /autoComplete="current-password"/, "password input should expose the current-password autocomplete hint");
});

test("login action normalizes email before authenticating", () => {
  assert.match(
    authActionSource,
    /function normalizeEmail\(value: FormDataEntryValue \| null\) \{\s*return String\(value \|\| ""\)\.trim\(\)\.toLowerCase\(\);\s*\}/,
    "auth action should trim and lowercase email values",
  );
  assert.match(
    authActionSource,
    /const email = normalizeEmail\(formData\.get\("email"\)\);/,
    "password sign-in should use normalized email values",
  );
});

test("login page displays the server action error without brittle language matching", () => {
  assert.doesNotMatch(
    loginSource,
    /Invalid login credentials/,
    "login UI should not depend on Supabase's English error text",
  );
  assert.match(
    loginSource,
    /setErrorMsg\(result\.error\);/,
    "login UI should show the localized server action error",
  );
});
