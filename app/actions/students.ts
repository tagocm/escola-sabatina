"use server";

import { requireTeacherAction } from "@/lib/auth/guards";
import {
  buildTeacherStudentPhotoPath,
  normalizeStudentPhotoPath,
  uploadStudentPhoto,
} from "@/lib/storage/student-photos";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function getStudents(classId?: string, includeInactive = false) {
  const auth = await requireTeacherAction();
  if ("error" in auth) {
    return [];
  }

  const { supabase } = auth;
  
  let query = supabase
    .from("students")
    .select("*")
    .order("full_name", { ascending: true });

  if (classId) {
    query = query.eq("class_id", classId);
  }

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching students:", error);
    return [];
  }

  return data;
}

export async function getStudentById(id: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) {
    return null;
  }

  const { supabase } = auth;
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
}

export async function upsertStudentAction(studentId: string | undefined, formData: FormData) {
  const auth = await requireTeacherAction();
  if ("error" in auth) {
    return auth;
  }

  const { supabase } = auth;
  
  const classId = formData.get("classId") as string;
  const fullName = formData.get("fullName") as string;
  const birthDate = formData.get("birthDate") as string;
  const sex = formData.get("sex") as "masculino" | "feminino";
  const guardianName = formData.get("guardianName") as string;
  const whatsapp = formData.get("whatsapp") as string;
  const photoFile = formData.get("photo") as File | null;
  const currentPhotoPath = normalizeStudentPhotoPath(formData.get("currentPhotoPath") as string | null);

  if (!classId || !fullName || !sex) {
    return { error: "Classe, nome e sexo são obrigatórios." };
  }

  let photoPath = currentPhotoPath;

  // Handle Image Upload
  if (photoFile && photoFile.size > 0) {
    const uploadResult = await uploadStudentPhoto(supabase, buildTeacherStudentPhotoPath(classId), photoFile);
    if ("error" in uploadResult) {
      return uploadResult;
    }

    photoPath = uploadResult.path;
  }

  const studentData = {
    class_id: classId,
    full_name: fullName,
    birth_date: birthDate || null,
    sex,
    guardian_name: guardianName || null,
    whatsapp: whatsapp || null,
    photo_url: photoPath,
    is_active: true,
  };

  if (studentId) {
    const { error } = await supabase
      .from("students")
      .update(studentData)
      .eq("id", studentId);

    if (error) return { error: "Não foi possível atualizar o aluno." };
  } else {
    const { error } = await supabase
      .from("students")
      .insert(studentData);

    if (error) return { error: "Não foi possível cadastrar o aluno." };
  }

  revalidatePath("/alunos");
  revalidatePath("/classes");
  revalidatePath("/relatorios/lancamento");
  revalidatePath("/relatorios/ofertas");
  redirect("/alunos");
}

export async function toggleStudentStatus(id: string, isActive: boolean) {
  const auth = await requireTeacherAction();
  if ("error" in auth) {
    throw new Error(auth.error);
  }

  const { supabase } = auth;
  const { error } = await supabase
    .from("students")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    throw new Error("Não foi possível atualizar o status do aluno.");
  }

  revalidatePath("/alunos");
  revalidatePath("/responsavel");
  revalidatePath("/responsavel/filhos");
  revalidatePath("/relatorios/lancamento");
  revalidatePath("/relatorios/ofertas");
}

export async function deactivateStudentByTeacher(id: string) {
  await toggleStudentStatus(id, false);
  redirect("/alunos");
}
