"use server";

import { requireTeacherAction } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";

function parsePositiveInt(value: FormDataEntryValue | null, fallback = 1) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getMonthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(year, monthNumber - 1, 1, 12, 0, 0);
  const end = new Date(year, monthNumber, 0, 12, 0, 0);
  return { start, end };
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function firstSaturdayOfYear(year: number) {
  const start = new Date(year, 0, 1, 12, 0, 0);
  const saturday = new Date(start);
  saturday.setDate(start.getDate() + ((6 - start.getDay() + 7) % 7));
  return saturday;
}

function weeksBetween(base: Date, target: Date) {
  const ms = target.getTime() - base.getTime();
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
}

export async function getResponsibilityTemplates(classId: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return [];

  const { supabase } = auth;
  const { data, error } = await supabase
    .from("class_responsibility_templates")
    .select("*")
    .eq("class_id", classId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching responsibility templates:", error);
    return [];
  }

  return data || [];
}

export async function createResponsibilityTemplateAction(classId: string, formData: FormData) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase } = auth;
  const name = String(formData.get("name") || "").trim();
  const participantCount = parsePositiveInt(formData.get("participant_count"), 1);
  const frequencyWeeks = parsePositiveInt(formData.get("frequency_weeks"), 1);
  const messageTemplate = String(formData.get("message_template") || "").trim();

  if (!name || !messageTemplate) {
    return { error: "Nome da atividade e mensagem padrão são obrigatórios." };
  }

  const { error } = await supabase
    .from("class_responsibility_templates")
    .insert({
      class_id: classId,
      name,
      participant_count: participantCount,
      frequency_weeks: frequencyWeeks,
      message_template: messageTemplate,
      is_active: true,
    });

  if (error) {
    return { error: "Não foi possível criar a atividade." };
  }

  revalidatePath(`/classes/${classId}`);
  revalidatePath("/responsabilidades");
  revalidatePath("/");
  return { success: true };
}

export async function deleteResponsibilityTemplateAction(classId: string, templateId: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase } = auth;
  const { error } = await supabase
    .from("class_responsibility_templates")
    .delete()
    .eq("id", templateId)
    .eq("class_id", classId);

  if (error) {
    return { error: "Não foi possível remover a atividade." };
  }

  revalidatePath(`/classes/${classId}`);
  revalidatePath("/responsabilidades");
  return { success: true };
}

export async function getResponsibilitiesCalendar(classId: string, month: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) {
    return { days: [], students: [], templates: [] };
  }

  const { supabase } = auth;
  const { start, end } = getMonthBounds(month);

  const [templates, occurrences, assignments, students] = await Promise.all([
    getResponsibilityTemplates(classId),
    supabase
      .from("class_responsibility_occurrences")
      .select("template_id, scheduled_date, participant_count_override, is_cancelled")
      .eq("class_id", classId)
      .gte("scheduled_date", toDateInput(start))
      .lte("scheduled_date", toDateInput(end)),
    supabase
      .from("class_responsibility_assignments")
      .select(`
        id,
        template_id,
        scheduled_date,
        slot_index,
        student_id,
        students (
          id,
          full_name,
          photo_url
        )
      `)
      .eq("class_id", classId)
      .gte("scheduled_date", toDateInput(start))
      .lte("scheduled_date", toDateInput(end))
      .order("scheduled_date", { ascending: true })
      .order("slot_index", { ascending: true }),
    supabase
      .from("students")
      .select("id, full_name, photo_url, is_active")
      .eq("class_id", classId)
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
  ]);

  const assignmentRows = assignments.data || [];
  const studentRows = students.data || [];
  const occurrenceRows = occurrences.data || [];
  const yearBaseSaturday = firstSaturdayOfYear(start.getFullYear());
  const saturdays: string[] = [];
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + ((6 - cursor.getDay() + 7) % 7));

  while (cursor <= end) {
    saturdays.push(toDateInput(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }

  const days = saturdays.map((date) => {
    const current = new Date(`${date}T12:00:00`);
    const weekIndex = weeksBetween(yearBaseSaturday, current);

    const tasks = templates
      .filter((template: Record<string, unknown>) => template.is_active !== false)
      .filter((template: Record<string, unknown>) => weekIndex % Number(template.frequency_weeks || 1) === 0)
      .map((template: Record<string, unknown>) => {
        const templateAssignments = assignmentRows.filter(
          (assignment: Record<string, unknown>) =>
            assignment.template_id === template.id && assignment.scheduled_date === date,
        );
        const occurrence = occurrenceRows.find(
          (item: Record<string, unknown>) =>
            item.template_id === template.id && item.scheduled_date === date,
        );
        if (occurrence?.is_cancelled) {
          return null;
        }
        const participantCount = Number(
          occurrence?.participant_count_override || template.participant_count || 1,
        );

        return {
          id: template.id as string,
          name: template.name as string,
          participantCount,
          frequencyWeeks: Number(template.frequency_weeks || 1),
          messageTemplate: template.message_template as string,
          assignments: templateAssignments.map((assignment: Record<string, unknown>) => ({
            id: assignment.id as string,
            slotIndex: Number(assignment.slot_index || 0),
            studentId: assignment.student_id as string,
            studentName: (Array.isArray(assignment.students) ? assignment.students[0] : assignment.students)?.full_name || "Aluno",
            studentPhotoUrl: (Array.isArray(assignment.students) ? assignment.students[0] : assignment.students)?.photo_url || null,
          })),
        };
      })
      .filter((task): task is {
        id: string;
        name: string;
        participantCount: number;
        frequencyWeeks: number;
        messageTemplate: string;
        assignments: Array<{
          id: string;
          slotIndex: number;
          studentId: string;
          studentName: string;
          studentPhotoUrl: string | null;
        }>;
      } => task !== null);

    return {
      date,
      label: current.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      fullLabel: current.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
      tasks,
    };
  });

  return {
    days,
    students: studentRows,
    templates,
  };
}

export async function assignResponsibilityAction(classId: string, formData: FormData) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase, user } = auth;

  const templateId = String(formData.get("templateId") || "");
  const studentId = String(formData.get("studentId") || "");
  const scheduledDate = String(formData.get("scheduledDate") || "");
  const slotIndex = Number.parseInt(String(formData.get("slotIndex") || "0"), 10) || 0;

  if (!templateId || !studentId || !scheduledDate) {
    return { error: "Selecione um aluno válido para a atividade." };
  }

  const { error } = await supabase
    .from("class_responsibility_assignments")
    .upsert(
      {
        class_id: classId,
        template_id: templateId,
        scheduled_date: scheduledDate,
        slot_index: slotIndex,
        student_id: studentId,
        assigned_by: user?.id || null,
      },
      { onConflict: "template_id,scheduled_date,slot_index" },
    );

  if (error) {
    return { error: "Não foi possível atribuir o aluno à atividade." };
  }

  revalidatePath("/responsabilidades");
  return { success: true };
}

export async function drawResponsibilityAction(classId: string, formData: FormData) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase, user } = auth;

  const templateId = String(formData.get("templateId") || "");
  const scheduledDate = String(formData.get("scheduledDate") || "");
  const participantCount = parsePositiveInt(formData.get("participantCount"), 1);

  if (!templateId || !scheduledDate) {
    return { error: "Dados da atividade inválidos para sorteio." };
  }

  const [{ data: students }, { data: assignmentCounts }, { data: existing }] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name")
      .eq("class_id", classId)
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("class_responsibility_assignments")
      .select("student_id")
      .eq("class_id", classId),
    supabase
      .from("class_responsibility_assignments")
      .select("slot_index, student_id")
      .eq("class_id", classId)
      .eq("template_id", templateId)
      .eq("scheduled_date", scheduledDate),
  ]);

  const allStudents = students || [];
  const existingAssignments = existing || [];
  const occupiedStudentIds = new Set(existingAssignments.map((item) => item.student_id));
  const assignmentCountMap = (assignmentCounts || []).reduce<Record<string, number>>((acc, item) => {
    acc[item.student_id] = (acc[item.student_id] || 0) + 1;
    return acc;
  }, {});

  const availableStudents = allStudents
    .filter((student) => !occupiedStudentIds.has(student.id))
    .sort((a, b) => {
      const diff = (assignmentCountMap[a.id] || 0) - (assignmentCountMap[b.id] || 0);
      if (diff !== 0) return diff;
      return a.full_name.localeCompare(b.full_name, "pt-BR");
    });

  if (availableStudents.length === 0) {
    return { error: "Não há alunos disponíveis para sorteio nesta atividade." };
  }

  const inserts = [];
  for (let slotIndex = 0; slotIndex < participantCount; slotIndex += 1) {
    const existingSlot = existingAssignments.find((item) => item.slot_index === slotIndex);
    if (existingSlot) continue;
    const candidate = availableStudents.shift();
    if (!candidate) break;
    inserts.push({
      class_id: classId,
      template_id: templateId,
      scheduled_date: scheduledDate,
      slot_index: slotIndex,
      student_id: candidate.id,
      assigned_by: user?.id || null,
    });
  }

  if (inserts.length === 0) {
    return { error: "Todos os participantes desta atividade já foram definidos." };
  }

  const { error } = await supabase.from("class_responsibility_assignments").insert(inserts);
  if (error) {
    return { error: "Não foi possível concluir o sorteio." };
  }

  revalidatePath("/responsabilidades");
  return { success: true };
}

export async function updateResponsibilitySlotCountAction(classId: string, formData: FormData) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase } = auth;
  const templateId = String(formData.get("templateId") || "");
  const scheduledDate = String(formData.get("scheduledDate") || "");
  const participantCount = parsePositiveInt(formData.get("participantCount"), 1);

  if (!templateId || !scheduledDate) {
    return { error: "Dados da atividade inválidos." };
  }

  const { error } = await supabase
    .from("class_responsibility_occurrences")
    .upsert(
      {
        class_id: classId,
        template_id: templateId,
        scheduled_date: scheduledDate,
        participant_count_override: participantCount,
        is_cancelled: false,
      },
      { onConflict: "template_id,scheduled_date" },
    );

  if (error) {
    return { error: "Não foi possível atualizar a quantidade de vagas." };
  }

  revalidatePath("/responsabilidades");
  return { success: true };
}

export async function deleteResponsibilityTaskForDayAction(classId: string, formData: FormData) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase } = auth;
  const templateId = String(formData.get("templateId") || "");
  const scheduledDate = String(formData.get("scheduledDate") || "");

  if (!templateId || !scheduledDate) {
    return { error: "Dados da atividade inválidos." };
  }

  const [{ error: occurrenceError }, { error: assignmentsError }] = await Promise.all([
    supabase
      .from("class_responsibility_occurrences")
      .upsert(
        {
          class_id: classId,
          template_id: templateId,
          scheduled_date: scheduledDate,
          is_cancelled: true,
        },
        { onConflict: "template_id,scheduled_date" },
      ),
    supabase
      .from("class_responsibility_assignments")
      .delete()
      .eq("class_id", classId)
      .eq("template_id", templateId)
      .eq("scheduled_date", scheduledDate),
  ]);

  if (occurrenceError) {
    return { error: "Não foi possível remover a atividade deste sábado." };
  }

  if (assignmentsError) {
    return { error: "Não foi possível limpar as vagas desta atividade." };
  }

  revalidatePath("/responsabilidades");
  return { success: true };
}

export async function deleteResponsibilityAssignmentAction(classId: string, formData: FormData) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase } = auth;
  const templateId = String(formData.get("templateId") || "");
  const scheduledDate = String(formData.get("scheduledDate") || "");
  const slotIndex = Number.parseInt(String(formData.get("slotIndex") || "0"), 10) || 0;

  if (!templateId || !scheduledDate) {
    return { error: "Dados da vaga inválidos." };
  }

  const { error } = await supabase
    .from("class_responsibility_assignments")
    .delete()
    .eq("class_id", classId)
    .eq("template_id", templateId)
    .eq("scheduled_date", scheduledDate)
    .eq("slot_index", slotIndex);

  if (error) {
    return { error: "Não foi possível remover a vaga." };
  }

  revalidatePath("/responsabilidades");
  return { success: true };
}
