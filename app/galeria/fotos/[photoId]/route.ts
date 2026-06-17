import { CLASS_GALLERY_BUCKET } from "@/lib/gallery/sabbath";
import {
  canAccessClassGalleryPhoto,
  createGalleryAdminClient,
  decodeGalleryPhotoId,
  getClassIdFromGalleryPath,
} from "@/lib/gallery/server";
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

  const galleryAdminSupabase = createGalleryAdminClient();
  if (!galleryAdminSupabase) {
    return new Response("Galeria não configurada", { status: 500 });
  }

  const storagePath = decodeGalleryPhotoId(photoId);
  const classId = storagePath ? getClassIdFromGalleryPath(storagePath) : null;

  if (!storagePath || !classId) {
    return new Response("Foto não encontrada", { status: 404 });
  }

  const canAccess = await canAccessClassGalleryPhoto(
    galleryAdminSupabase,
    user.id,
    classId,
  );

  if (!canAccess) {
    return new Response("Foto não encontrada", { status: 404 });
  }

  const { data, error } = await galleryAdminSupabase.storage
    .from(CLASS_GALLERY_BUCKET)
    .download(storagePath);

  if (error || !data) {
    return new Response("Foto não encontrada", { status: 404 });
  }

  return new Response(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
      "Vary": "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
