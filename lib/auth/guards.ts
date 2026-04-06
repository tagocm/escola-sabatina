import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "teacher" | "guardian" | null;

async function resolveRole(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<AppRole> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (data?.role === "guardian") return "guardian";
  return "teacher";
}

export async function requireTeacherPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = await resolveRole(supabase, user.id);
  if (role === "guardian") {
    redirect("/responsavel");
  }

  return { supabase, user, role };
}

export async function requireGuardianPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = await resolveRole(supabase, user.id);
  if (role !== "guardian") {
    redirect("/");
  }

  return { supabase, user, role };
}

export async function requireTeacherAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Não autenticado." } as const;
  }

  const role = await resolveRole(supabase, user.id);
  if (role === "guardian") {
    return { error: "Acesso não autorizado." } as const;
  }

  return { supabase, user, role } as const;
}

export async function requireGuardianAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Não autenticado." } as const;
  }

  const role = await resolveRole(supabase, user.id);
  if (role !== "guardian") {
    return { error: "Acesso não autorizado." } as const;
  }

  return { supabase, user, role } as const;
}
