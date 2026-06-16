import { CLASS_GALLERY_BUCKET } from "@/lib/gallery/sabbath";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ photoId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { photoId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Não autenticado", { status: 401 });
  }

  const { data: photo } = await supabase
    .from("class_gallery_photos")
    .select("id, storage_path, content_type")
    .eq("id", photoId)
    .maybeSingle();

  if (!photo) {
    return new Response("Foto não encontrada", { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from(CLASS_GALLERY_BUCKET)
    .download(photo.storage_path);

  if (error || !data) {
    return new Response("Foto não encontrada", { status: 404 });
  }

  return new Response(data, {
    headers: {
      "Content-Type": photo.content_type || data.type || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
      "Vary": "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
