"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import WebSocket from "ws";

const webSocketTransport = WebSocket as unknown as WebSocketLikeConstructor;

function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value || "").trim().toLowerCase();
}

function validatePassword(password: string) {
  if (password.length !== 6) {
    return "A senha deve ter exatamente 6 caracteres.";
  }

  return null;
}

function mapSignUpError(error: { message?: string; code?: string; status?: number } | null) {
  if (!error) return "Não foi possível criar a conta.";

  if (error.code === "over_email_send_rate_limit" || error.status === 429) {
    return "Muitas tentativas de cadastro em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }

  if (error.code === "user_already_exists" || error.code === "email_exists") {
    return "Já existe uma conta com este e-mail.";
  }

  if ((error.message || "").toLowerCase().includes("user already registered")) {
    return "Já existe uma conta com este e-mail.";
  }

  return "Não foi possível criar a conta.";
}

function mapPasswordResetError(error: { message?: string; code?: string; status?: number } | null) {
  if (error?.code === "over_email_send_rate_limit" || error?.status === 429) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }

  return "Não foi possível enviar o e-mail de redefinição.";
}

function normalizeConfiguredOrigin(value: string | undefined) {
  if (!value) return null;
  return value.startsWith("http://") || value.startsWith("https://")
    ? value
    : `https://${value}`;
}

async function getRequestOrigin() {
  const configuredOrigin =
    normalizeConfiguredOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeConfiguredOrigin(process.env.SITE_URL) ||
    normalizeConfiguredOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeConfiguredOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizeConfiguredOrigin(process.env.VERCEL_URL);

  if (configuredOrigin) return configuredOrigin;

  const headerStore = await headers();
  const origin = headerStore.get("origin");
  if (origin) return origin;

  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  if (!host) return "http://localhost:3000";

  const protocol = headerStore.get("x-forwarded-proto") || "https";
  return `${protocol}://${host}`;
}

async function getPasswordResetRedirectUrl() {
  const origin = await getRequestOrigin();
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", "/auth/nova-senha");
  return callbackUrl.toString();
}

function createAdminClient() {
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!serviceRoleKey) return null;

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        transport: webSocketTransport,
      },
    }
  );
}

async function signUpWithoutEmailConfirmation({
  email,
  password,
  userMetadata,
  fallbackError,
}: {
  email: string;
  password: string;
  userMetadata: Record<string, string | null>;
  fallbackError: string;
}) {
  const adminClient = createAdminClient();

  if (adminClient) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (error) return { error: mapSignUpError(error) };
    if (!data.user) return { error: fallbackError };

    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return { error: "Conta criada, mas não foi possível iniciar a sessão automaticamente." };
    }

    return { success: true };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: userMetadata,
    },
  });

  if (error) return { error: mapSignUpError(error) };
  if (!data.user) return { error: fallbackError };
  if (data.session) return { success: true };

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return {
      error:
        "Este ambiente ainda exige confirmação de e-mail no Supabase Auth. Desative essa exigência ou configure SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  return { success: true };
}

export async function signInWithPassword(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "E-mail e senha são obrigatórios." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "E-mail ou senha inválidos." };
  }
  
  return { success: true };
}

export async function requestPasswordReset(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));

  if (!email) {
    return { error: "Informe um e-mail válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: await getPasswordResetRedirectUrl(),
  });

  if (error) {
    return { error: mapPasswordResetError(error) };
  }

  return { success: true };
}

export async function updatePasswordAfterReset(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  const passwordValidationError = validatePassword(password);
  if (passwordValidationError) return { error: passwordValidationError };

  if (password !== confirmPassword) {
    return { error: "As senhas não conferem." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Link expirado ou inválido. Solicite uma nova redefinição de senha." };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: "Não foi possível atualizar a senha." };
  }

  await supabase.auth.signOut();

  return { success: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
export async function signUpWithInvite(formData: FormData, token: string) {
  const email = normalizeEmail(formData.get("email"));
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;
  const sex = formData.get("sex") as string;
  const birthDate = formData.get("birthDate") as string;
  const whatsapp = formData.get("whatsapp") as string;

  const passwordValidationError = validatePassword(password);
  if (passwordValidationError) return { error: passwordValidationError };

  return signUpWithoutEmailConfirmation({
    email,
    password,
    userMetadata: {
      full_name: fullName,
      role: "teacher",
      sex,
      birth_date: birthDate,
      whatsapp,
      invite_token: token,
    },
    fallbackError: "Erro ao criar conta com o convite.",
  });
}

export async function updateProfile(formData: FormData) {
  const fullName = formData.get("fullName") as string;
  const sex = formData.get("sex") as string;
  const birthDate = formData.get("birthDate") as string;
  const whatsapp = formData.get("whatsapp") as string;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Não autenticado" };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      sex: sex as "masculino" | "feminino",
      birth_date: birthDate,
      whatsapp,
    })
    .eq("id", user.id);

  if (error) return { error: "Não foi possível atualizar o perfil." };

  return { success: true };
}

export async function signUpAsGuardian(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;
  const whatsapp = formData.get("whatsapp") as string;

  if (!email || !password || !fullName) {
    return { error: "Email, senha e nome são obrigatórios." };
  }

  const passwordValidationError = validatePassword(password);
  if (passwordValidationError) return { error: passwordValidationError };

  return signUpWithoutEmailConfirmation({
    email,
    password,
    userMetadata: {
      full_name: fullName,
      role: "guardian",
      whatsapp: whatsapp || null,
    },
    fallbackError: "Erro ao criar conta.",
  });
}
