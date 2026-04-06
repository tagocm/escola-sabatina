"use server";

import { createClient } from "@/lib/supabase/server";

function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value || "").trim().toLowerCase();
}

function validatePassword(password: string) {
  if (password.length < 8) {
    return "A senha deve ter pelo menos 8 caracteres.";
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
    return "A senha deve conter maiúscula, minúscula, número e caractere especial.";
  }

  return null;
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

  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: "teacher",
        sex,
        birth_date: birthDate,
        whatsapp,
        invite_token: token,
      },
    },
  });

  if (authError) return { error: "Não foi possível criar a conta com esse convite." };
  if (!authData.user) return { error: "Erro ao criar conta com o convite." };

  return {
    success: true,
    requiresEmailConfirmation: !authData.session,
  };
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

  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: "guardian",
        whatsapp: whatsapp || null,
      },
    },
  });

  if (authError) return { error: "Não foi possível criar a conta." };
  if (!authData.user) return { error: "Erro ao criar conta." };

  return {
    success: true,
    requiresEmailConfirmation: !authData.session,
  };
}
