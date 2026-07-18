import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const passwordInputSource = readFileSync(
  new URL("../components/ui/PasswordInput.tsx", import.meta.url),
  "utf8",
);

const passwordSurfaces = [
  "../app/(auth)/login/page.tsx",
  "../app/auth/nova-senha/page.tsx",
  "../components/ui/GuardianSignUpForm.tsx",
  "../components/ui/InviteSignUpForm.tsx",
];

test("password visibility control is accessible and never submits the toggle", () => {
  assert.match(passwordInputSource, /type=\{isVisible \? "text" : "password"\}/);
  assert.match(passwordInputSource, /type="button"/);
  assert.match(passwordInputSource, /aria-controls=\{inputId\}/);
  assert.match(passwordInputSource, /aria-label=\{toggleLabel\}/);
  assert.match(passwordInputSource, /aria-pressed=\{isVisible\}/);
  assert.match(passwordInputSource, /`Mostrar \$\{visibilityLabel\}`/);
  assert.match(passwordInputSource, /`Ocultar \$\{visibilityLabel\}`/);
});

test("every password surface uses the shared visibility control", () => {
  for (const relativePath of passwordSurfaces) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /<PasswordInput/);
    assert.doesNotMatch(source, /type="password"/);
  }
});
