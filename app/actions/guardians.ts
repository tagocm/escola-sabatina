"use server";

import { requireGuardianAction } from "@/lib/auth/guards";
import {
  buildGuardianStudentPhotoPath,
  normalizeStudentPhotoPath,
  uploadStudentPhoto,
} from "@/lib/storage/student-photos";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ============================================================
// READ: Guardian's children
// ============================================================
export async function getGuardianStudents() {
  const auth = await requireGuardianAction();
  if ("error" in auth) return [];

  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from("guardian_students")
    .select(`
      student_id,
      students (
        id, full_name, birth_date, sex, photo_url, 
        guardian_name, whatsapp, is_active, class_id,
        classes (id, name)
      )
    `)
    .eq("guardian_id", user.id);

  if (error) {
    console.error("Error fetching guardian students:", error);
    return [];
  }

  return (data || [])
    .map((gs: Record<string, unknown>) => gs.students as Record<string, unknown> | null)
    .filter((student): student is Record<string, unknown> => Boolean(student?.is_active));
}

export async function deactivateGuardianStudent(studentId: string) {
  const auth = await requireGuardianAction();
  if ("error" in auth) {
    throw new Error(auth.error);
  }

  const { supabase, user } = auth;

  const { data: link, error: linkError } = await supabase
    .from("guardian_students")
    .select("student_id")
    .eq("guardian_id", user.id)
    .eq("student_id", studentId)
    .maybeSingle();

  if (linkError || !link) {
    throw new Error("Aluno não vinculado a este responsável.");
  }

  const { error } = await supabase
    .from("students")
    .update({ is_active: false })
    .eq("id", studentId);

  if (error) {
    throw new Error("Não foi possível ocultar o dependente.");
  }

  revalidatePath("/responsavel");
  revalidatePath("/responsavel/filhos");
  revalidatePath("/alunos");
  revalidatePath("/relatorios/lancamento");
  revalidatePath("/relatorios/ofertas");
}

// ============================================================
// CREATE: Register a new child
// ============================================================
export async function createGuardianStudent(formData: FormData) {
  const auth = await requireGuardianAction();
  if ("error" in auth) return auth;

  const { supabase, user } = auth;

  const fullName = formData.get("fullName") as string;
  const birthDate = formData.get("birthDate") as string;
  const sex = formData.get("sex") as "masculino" | "feminino";
  const whatsapp = formData.get("whatsapp") as string;
  const photoFile = formData.get("photo") as File | null;
  const targetClassId = formData.get("classId") as string | null;
  const resolvedClassId = targetClassId && targetClassId !== "" ? targetClassId : null;

  if (!fullName || !sex || !whatsapp) {
    return { error: "Nome, sexo e WhatsApp são obrigatórios." };
  }

  // 0. Intelligent WhatsApp Sync
  const { data: profile } = await supabase
    .from("profiles")
    .select("whatsapp")
    .eq("id", user.id)
    .single();

  if (!profile?.whatsapp) {
    // If guardian has no whatsapp, update their profile
    await supabase.from("profiles").update({ whatsapp }).eq("id", user.id);
  }

  let photoPath: string | null = null;

  // Handle photo upload
  if (photoFile && photoFile.size > 0) {
    const uploadResult = await uploadStudentPhoto(supabase, buildGuardianStudentPhotoPath(user.id), photoFile);
    if ("error" in uploadResult) {
      return uploadResult;
    }

    photoPath = uploadResult.path;
  }

  const studentId = crypto.randomUUID();

  const { error: rpcError } = await supabase.rpc("register_guardian_student", {
    p_id: studentId,
    p_full_name: fullName,
    p_birth_date: birthDate || null,
    p_sex: sex,
    p_guardian_name: user.user_metadata?.full_name || null,
    p_whatsapp: whatsapp || null,
    p_photo_url: photoPath,
    p_class_id: resolvedClassId,
  });

  if (rpcError) {
    console.error("Erro ao registrar aluno no DB:", rpcError);
    return { error: "Não foi possível cadastrar e vincular o dependente." };
  }

  revalidatePath("/responsavel");
  revalidatePath("/responsavel/filhos");
  revalidatePath("/alunos");
  redirect("/responsavel");
}

// ============================================================
// UPDATE: Edit child data
// ============================================================
export async function updateGuardianStudent(studentId: string, formData: FormData) {
  const auth = await requireGuardianAction();
  if ("error" in auth) return auth;

  const { supabase, user } = auth;

  const fullName = formData.get("fullName") as string;
  const birthDate = formData.get("birthDate") as string;
  const sex = formData.get("sex") as "masculino" | "feminino";
  const whatsapp = formData.get("whatsapp") as string;
  const photoFile = formData.get("photo") as File | null;
  const currentPhotoPath = normalizeStudentPhotoPath(formData.get("currentPhotoPath") as string | null);

  if (!fullName || !sex || !whatsapp) {
    return { error: "Nome, sexo e WhatsApp são obrigatórios." };
  }

  // 0. Intelligent WhatsApp Sync
  const { data: profile } = await supabase
    .from("profiles")
    .select("whatsapp")
    .eq("id", user.id)
    .single();

  if (!profile?.whatsapp) {
    // If guardian has no whatsapp, update their profile
    await supabase.from("profiles").update({ whatsapp }).eq("id", user.id);
  }

  let photoPath = currentPhotoPath;

  if (photoFile && photoFile.size > 0) {
    const uploadResult = await uploadStudentPhoto(supabase, buildGuardianStudentPhotoPath(user.id), photoFile);
    if ("error" in uploadResult) return uploadResult;

    photoPath = uploadResult.path;
  }

  const { error } = await supabase
    .from("students")
    .update({
      full_name: fullName,
      birth_date: birthDate || null,
      sex,
      whatsapp: whatsapp || null,
      photo_url: photoPath,
    })
    .eq("id", studentId);

  if (error) return { error: "Não foi possível atualizar o dependente." };

  revalidatePath("/responsavel/filhos");
  redirect("/responsavel/filhos");
}

// ============================================================
// SEARCH: Available classes for enrollment
// ============================================================
export async function getAvailableClasses() {
  const auth = await requireGuardianAction();
  if ("error" in auth) return [];

  const { supabase } = auth;

  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching available classes:", error);
    return [];
  }

  return (data || []).filter(c => c.is_active);
}

export async function getGuardianClassOfferingSummary(studentId: string) {
  const auth = await requireGuardianAction();
  if ("error" in auth) return null;

  const { supabase } = auth;
  const { data, error } = await supabase.rpc("get_guardian_class_offering_summary", {
    p_student_id: studentId,
  });

  if (error) {
    console.error("Error fetching guardian class offering summary:", error);
    return null;
  }

  return Array.isArray(data) ? (data[0] ?? null) : data;
}

// ============================================================
// CREATE: Enrollment request
// ============================================================
export async function createEnrollmentRequest(studentId: string, classId: string) {
  const auth = await requireGuardianAction();
  if ("error" in auth) return auth;

  const { supabase, user } = auth;

  const { error } = await supabase
    .from("enrollment_requests")
    .insert({
      student_id: studentId,
      class_id: classId,
      requested_by: user.id,
    });

  if (error) {
    if (error.code === "23505") {
      return { error: "Solicitação já enviada para esta classe." };
    }
    return { error: "Não foi possível enviar a solicitação." };
  }

  revalidatePath("/responsavel/solicitacoes");
  return { success: true };
}

// ============================================================
// READ: Guardian's enrollment requests
// ============================================================
export async function getMyEnrollmentRequests() {
  const auth = await requireGuardianAction();
  if ("error" in auth) return [];

  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from("enrollment_requests")
    .select(`
      id, status, created_at, updated_at,
      students (id, full_name, photo_url),
      classes (id, name)
    `)
    .eq("requested_by", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching enrollment requests:", error);
    return [];
  }

  return data || [];
}

export interface GuardianStudentProgressPoint {
  student_id: string;
  student_name: string;
  class_id: string | null;
  class_name: string | null;
  day_date: string;
  student_points: number;
  class_average: number;
  class_highest: number;
  class_size: number;
}

export async function getGuardianStudentProgress(studentId: string): Promise<GuardianStudentProgressPoint[]> {
  const auth = await requireGuardianAction();
  if ("error" in auth) return [];

  const { supabase } = auth;

  const { data, error } = await supabase.rpc("get_guardian_student_progress", {
    p_student_id: studentId,
  });

  if (error) {
    console.error("Error fetching guardian progress:", error);
    return [];
  }

  return (data || []) as GuardianStudentProgressPoint[];
}

export interface GuardianMailboxMessage {
  message_id: string;
  message_type: "indisciplina" | "calendario" | "aviso";
  title: string;
  body: string;
  happened_at: string;
}

export async function getGuardianStudentMailbox(studentId: string): Promise<GuardianMailboxMessage[]> {
  const auth = await requireGuardianAction();
  if ("error" in auth) return [];

  const { supabase } = auth;

  const { data, error } = await supabase.rpc("get_guardian_student_mailbox", {
    p_student_id: studentId,
  });

  if (error) {
    console.error("Error fetching guardian mailbox:", error);
    return [];
  }

  return (data || []) as GuardianMailboxMessage[];
}

// ============================================================
// READ: Get user role
// ============================================================
export async function getUserRole(): Promise<"teacher" | "guardian" | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return (data?.role as "teacher" | "guardian") || null;
}
