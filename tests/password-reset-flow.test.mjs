import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;

function readSource(relativePath) {
  const filePath = join(repoRoot, relativePath);
  assert.ok(existsSync(filePath), `${relativePath} should exist`);
  return readFileSync(filePath, "utf8");
}

test("login exposes the forgot password entry point", () => {
  const loginSource = readSource("app/(auth)/login/page.tsx");

  assert.match(loginSource, /href="\/esqueci-minha-senha"/);
  assert.match(loginSource, /Esqueci minha senha/);
});

test("password reset request uses Supabase Auth without application database writes", () => {
  const authActionSource = readSource("app/actions/auth.ts");
  const forgotPageSource = readSource("app/esqueci-minha-senha/page.tsx");

  assert.match(authActionSource, /export async function requestPasswordReset\(formData: FormData\)/);
  assert.match(authActionSource, /\.auth\.resetPasswordForEmail\(email,/);
  assert.match(authActionSource, /redirectTo: await getPasswordResetRedirectUrl\(\)/);
  assert.doesNotMatch(authActionSource, /\.from\(["'].*password/i);
  assert.match(forgotPageSource, /requestPasswordReset/);
});

test("password reset callback establishes a Supabase session before changing the password", () => {
  const callbackRouteSource = readSource("app/auth/callback/route.ts");
  const confirmRouteSource = readSource("app/auth/confirm/route.ts");

  assert.match(callbackRouteSource, /exchangeCodeForSession\(code\)/);
  assert.match(callbackRouteSource, /next = searchParams\.get\("next"\) \?\? "\/"/);
  assert.match(confirmRouteSource, /verifyOtp\(\{\s*type,\s*token_hash,/s);
  assert.match(confirmRouteSource, /type EmailOtpType/);
});

test("new password page updates the authenticated Supabase user and returns to login", () => {
  const authActionSource = readSource("app/actions/auth.ts");
  const resetPageSource = readSource("app/auth/nova-senha/page.tsx");

  assert.match(authActionSource, /export async function updatePasswordAfterReset\(formData: FormData\)/);
  assert.match(authActionSource, /\.auth\.updateUser\(\{\s*password\s*\}\)/s);
  assert.match(authActionSource, /\.auth\.signOut\(\)/);
  assert.match(resetPageSource, /updatePasswordAfterReset/);
  assert.match(resetPageSource, /\/login/);
});
