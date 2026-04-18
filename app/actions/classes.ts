"use server";

import { requireTeacherAction } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function parseCurrencyInput(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) return 0;

  if (raw.includes("R$") || raw.includes(",")) {
    const normalized = raw
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePositiveInt(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeWeekDateInput(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const baseDate = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(baseDate.getTime())) return null;

  const saturday = new Date(baseDate);
  saturday.setHours(12, 0, 0, 0);
  saturday.setDate(saturday.getDate() + (6 - saturday.getDay()));

  return `${saturday.getFullYear()}-${String(saturday.getMonth() + 1).padStart(2, "0")}-${String(saturday.getDate()).padStart(2, "0")}`;
}

function isUniqueConstraintError(error: { code?: string } | null) {
  return error?.code === "23505";
}

export async function getClasses() {
  const auth = await requireTeacherAction();
  if ("error" in auth) return [];

  const { supabase } = auth;
  
  const { data, error } = await supabase
    .from("classes")
    .select(`
      id,
      name,
      offering_goal,
      is_active,
      created_at,
      class_members (count),
      students (count)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching classes:", error);
    return [];
  }

  // Tratamento do retorno count relacional do PostgREST
  return data.map((c: { 
    id: string; 
    name: string; 
    offering_goal: number;
    is_active: boolean; 
    created_at: string; 
    class_members: { count: number }[]; 
    students: { count: number }[] 
  }) => ({
    ...c,
    professoresCount: c.class_members?.[0]?.count || 0,
    alunosCount: c.students?.[0]?.count || 0,
  }));
}

export async function getClassOptions() {
  const auth = await requireTeacherAction();
  if ("error" in auth) return [];

  const { supabase } = auth;

  const { data, error } = await supabase
    .from("classes")
    .select("id, name, is_active")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching class options:", error);
    return [];
  }

  return data || [];
}

export async function getClassById(id: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return null;

  const { supabase } = auth;
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return null;
  }
  
  return data;
}

export async function getClassWeeklyBibleVerses(classId: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return [];

  const { supabase } = auth;
  const { data, error } = await supabase
    .from("class_weekly_bible_verses")
    .select("id, week_date, verse_text, bible_book, chapter_number, verse_reference")
    .eq("class_id", classId)
    .order("week_date", { ascending: false });

  if (error) {
    console.error("Error fetching class weekly bible verses:", error);
    return [];
  }

  return data || [];
}

export async function getClassWeeklyBibleVerseByWeek(classId: string, weekDate: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return null;

  const normalizedWeekDate = normalizeWeekDateInput(weekDate);
  if (!normalizedWeekDate) return null;

  const { supabase } = auth;
  const { data, error } = await supabase
    .from("class_weekly_bible_verses")
    .select("id, week_date, verse_text, bible_book, chapter_number, verse_reference")
    .eq("class_id", classId)
    .eq("week_date", normalizedWeekDate)
    .maybeSingle();

  if (error) {
    console.error("Error fetching weekly bible verse by week:", error);
    return null;
  }

  return data;
}

export async function saveClassWeeklyBibleVerseAction(classId: string, formData: FormData) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase } = auth;
  const verseId = String(formData.get("id") || "").trim() || null;
  const weekDate = normalizeWeekDateInput(formData.get("week_date"));
  const verseText = String(formData.get("verse_text") || "").replace(/\r\n/g, "\n").trim();
  const bibleBook = String(formData.get("bible_book") || "").trim();
  const chapterNumber = parsePositiveInt(formData.get("chapter_number"));
  const verseReference = String(formData.get("verse_reference") || "").trim();

  if (!weekDate) {
    return { error: "Selecione uma semana válida para o verso." };
  }

  if (!verseText || !bibleBook || !chapterNumber || !verseReference) {
    return { error: "Preencha semana, verso, livro, capítulo e versículo." };
  }

  const payload = {
    class_id: classId,
    week_date: weekDate,
    verse_text: verseText,
    bible_book: bibleBook,
    chapter_number: chapterNumber,
    verse_reference: verseReference,
  };

  if (verseId) {
    const { error } = await supabase
      .from("class_weekly_bible_verses")
      .update(payload)
      .eq("id", verseId)
      .eq("class_id", classId);

    if (error) {
      console.error("Error updating weekly bible verse:", error);
      if (isUniqueConstraintError(error)) {
        return { error: "Já existe um verso cadastrado para esta semana." };
      }
      return { error: "Não foi possível atualizar o verso da semana." };
    }
  } else {
    const { error } = await supabase
      .from("class_weekly_bible_verses")
      .insert(payload);

    if (error) {
      console.error("Error creating weekly bible verse:", error);
      if (isUniqueConstraintError(error)) {
        return { error: "Já existe um verso cadastrado para esta semana." };
      }
      return { error: "Não foi possível cadastrar o verso da semana." };
    }
  }

  revalidatePath(`/classes/${classId}`);
  revalidatePath("/relatorios/lancamento");
  return { success: true };
}

export async function deleteClassWeeklyBibleVerseAction(classId: string, verseId: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase } = auth;
  const { error } = await supabase
    .from("class_weekly_bible_verses")
    .delete()
    .eq("id", verseId)
    .eq("class_id", classId);

  if (error) {
    console.error("Error deleting weekly bible verse:", error);
    return { error: "Não foi possível remover o verso da semana." };
  }

  revalidatePath(`/classes/${classId}`);
  revalidatePath("/relatorios/lancamento");
  return { success: true };
}

export async function createClassAction(formData: FormData) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase } = auth;
  const name = formData.get("name") as string;
  const is_active = formData.get("is_active") === "true";
  const offeringGoal = parseCurrencyInput(formData.get("offering_goal"));

  if (!name || name.trim() === "") {
    return { error: "Nome da classe é obrigatório" };
  }

  const { error } = await supabase.rpc("create_class", {
    p_name: name,
    p_is_active: is_active,
    p_offering_goal: offeringGoal,
  });

  if (error) {
    console.error("Error creating class:", error);
    return { error: "Não foi possível criar a classe." };
  }

  revalidatePath("/classes");
  revalidatePath("/");
  redirect("/classes");
}

export async function updateClassAction(id: string, formData: FormData) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase } = auth;
  const name = formData.get("name") as string;
  const is_active = formData.get("is_active") === "true";
  const offeringGoal = parseCurrencyInput(formData.get("offering_goal"));

  if (!name || name.trim() === "") {
    return { error: "Nome da classe é obrigatório" };
  }

  const { error } = await supabase
    .from("classes")
    .update({ name, is_active, offering_goal: offeringGoal })
    .eq("id", id);

  if (error) {
    console.error("Error updating class:", error);
    return { error: "Não foi possível atualizar a classe." };
  }

  revalidatePath("/classes");
  revalidatePath("/");
  redirect("/classes");
}

export async function transferStudentsToClassAction(sourceClassId: string, formData: FormData) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase } = auth;
  const targetClassId = formData.get("targetClassId") as string | null;

  if (!targetClassId) {
    return { error: "Selecione a classe de destino." };
  }

  if (targetClassId === sourceClassId) {
    return { error: "A classe de destino deve ser diferente da atual." };
  }

  const { error } = await supabase
    .from("students")
    .update({ class_id: targetClassId })
    .eq("class_id", sourceClassId)
    .eq("is_active", true);

  if (error) {
    console.error("Error transferring students:", error);
    return { error: "Não foi possível transferir os alunos." };
  }

  revalidatePath("/classes");
  revalidatePath(`/classes/${sourceClassId}`);
  revalidatePath(`/classes/${targetClassId}`);
  revalidatePath("/alunos");
  revalidatePath("/responsavel");
  revalidatePath("/responsavel/filhos");
  revalidatePath("/relatorios/lancamento");
  revalidatePath("/relatorios/ofertas");
  redirect(`/classes/${targetClassId}`);
}
export async function updateLastClass(classId: string | null) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase, user } = auth;

  const { error } = await supabase
    .from("profiles")
    .update({ last_class_id: classId })
    .eq("id", user.id);

  if (error) return { error: "Não foi possível atualizar a classe ativa." };

  revalidatePath("/", "layout");
  revalidatePath("/alunos", "page");
  return { success: true };
}

export async function generateInviteAction(classId: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase } = auth;
  const { data, error } = await supabase.rpc("generate_invite", {
    p_class_id: classId,
  });

  if (error) return { error: "Não foi possível gerar o convite." };

  return { token: data as string };
}

export async function getInviteData(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_invite_data", {
    p_token: token,
  });

  if (error) return null;
  if (!data || (Array.isArray(data) && data.length === 0)) return null;

  return Array.isArray(data) ? data[0] : data;
}

export async function getActiveClassContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // 1. Get profile last_class_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("last_class_id")
    .eq("id", user.id)
    .single();

  // 2. Get active memberships
  const { data: memberships } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("user_id", user.id)
    .eq("is_active", true);

  const memberClassIds = (memberships || []).map(m => m.class_id);

  if (memberClassIds.length === 0) return null;

  let resolvedClassId = profile?.last_class_id;

  // 3. Validate or Fallback
  if (!resolvedClassId || !memberClassIds.includes(resolvedClassId)) {
    resolvedClassId = memberClassIds[0];
    
    // 4. Silently update profile for next time
    await supabase
      .from("profiles")
      .update({ last_class_id: resolvedClassId })
      .eq("id", user.id);
  }

  return resolvedClassId;
}

// ============================================================
// Enrollment Requests Management (Teacher)
// ============================================================
export async function getPendingEnrollmentRequests(classId: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return [];

  const { supabase } = auth;

  const { data, error } = await supabase
    .from("enrollment_requests")
    .select(`
      id, status, created_at,
      students (id, full_name, photo_url, birth_date, sex),
      requested_by_profile:profiles!enrollment_requests_requested_by_fkey (full_name, whatsapp)
    `)
    .eq("class_id", classId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching enrollment requests:", error);
    return [];
  }

  return data || [];
}

export async function approveEnrollmentRequest(requestId: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase, user } = auth;

  // 1. Get the request
  const { data: request, error: fetchError } = await supabase
    .from("enrollment_requests")
    .select("id, student_id, class_id, status")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) return { error: "Solicitação não encontrada." };
  if (request.status !== "pending") return { error: "Solicitação já processada." };

  // 2. Assign student to class
  const { error: updateStudentError } = await supabase
    .from("students")
    .update({ class_id: request.class_id })
    .eq("id", request.student_id);

  if (updateStudentError) return { error: "Não foi possível aprovar a solicitação." };

  // 3. Mark request as approved
  const { error: updateRequestError } = await supabase
    .from("enrollment_requests")
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (updateRequestError) return { error: "Não foi possível concluir a aprovação." };

  revalidatePath("/classes");
  revalidatePath("/alunos");
  return { success: true };
}

export async function rejectEnrollmentRequest(requestId: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase, user } = auth;

  const { error } = await supabase
    .from("enrollment_requests")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) return { error: "Não foi possível rejeitar a solicitação." };

  revalidatePath("/classes");
  return { success: true };
}
