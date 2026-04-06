import { createClient } from "@/lib/supabase/server";
import { normalizeStudentPhotoPath } from "@/lib/storage/student-photos";

interface RouteContext {
  params: Promise<{ studentId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { studentId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Não autenticado", { status: 401 });
  }

  const { data: student } = await supabase
    .from("students")
    .select("id, photo_url")
    .eq("id", studentId)
    .maybeSingle();

  if (!student) {
    return new Response("Foto não encontrada", { status: 404 });
  }

  const photoPath = normalizeStudentPhotoPath(student.photo_url);
  if (!photoPath) {
    return new Response("Foto não encontrada", { status: 404 });
  }

  const { data, error } = await supabase.storage.from("student-photos").download(photoPath);
  if (error || !data) {
    return new Response("Foto não encontrada", { status: 404 });
  }

  return new Response(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      Vary: "Cookie",
    },
  });
}
