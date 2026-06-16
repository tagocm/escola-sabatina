"use server";

import { requireGuardianAction, requireTeacherAction } from "@/lib/auth/guards";
import {
  buildClassGalleryPhotoPath,
  CLASS_GALLERY_BUCKET,
  MAX_GALLERY_PHOTOS_PER_UPLOAD,
  normalizeGalleryPhotoTags,
  normalizeSabbathDateInput,
  validateGalleryPhotoFile,
} from "@/lib/gallery/sabbath";
import { revalidatePath } from "next/cache";

export type GalleryUploadState = {
  status: "idle" | "success" | "error";
  message?: string;
};

interface GalleryPhotoRow {
  id: string;
  class_id: string;
  week_date: string;
  storage_path: string;
  original_filename: string | null;
  content_type: string;
  file_size: number;
  tags: string[];
  caption: string | null;
  created_at: string;
  classes?: { name?: string | null } | { name?: string | null }[] | null;
}

function isFileEntry(value: FormDataEntryValue): value is File {
  return typeof value === "object"
    && value !== null
    && "size" in value
    && "type" in value
    && "name" in value;
}

function normalizeCaption(value: FormDataEntryValue | null) {
  const caption = String(value || "").replace(/\s+/g, " ").trim();
  return caption || null;
}

async function cleanupUploadedGalleryPaths(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  paths: string[],
) {
  if (paths.length === 0) return;

  await supabase
    .from("class_gallery_photos")
    .delete()
    .in("storage_path", paths);

  await supabase.storage.from(CLASS_GALLERY_BUCKET).remove(paths);
}

export async function getTeacherGalleryPhotos(classId: string, weekDate?: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return [];

  const { supabase } = auth;
  let query = supabase
    .from("class_gallery_photos")
    .select("id, class_id, week_date, storage_path, original_filename, content_type, file_size, tags, caption, created_at")
    .eq("class_id", classId)
    .order("week_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (weekDate) {
    query = query.eq("week_date", weekDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching teacher gallery photos:", error);
    return [];
  }

  return (data || []) as GalleryPhotoRow[];
}

export async function getGuardianGalleryPhotos() {
  const auth = await requireGuardianAction();
  if ("error" in auth) return [];

  const { supabase } = auth;
  const { data, error } = await supabase
    .from("class_gallery_photos")
    .select(`
      id, class_id, week_date, storage_path, original_filename, content_type, file_size, caption, created_at,
      tags,
      classes (name)
    `)
    .order("week_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching guardian gallery photos:", error);
    return [];
  }

  return (data || []) as GalleryPhotoRow[];
}

export async function uploadClassGalleryPhotosAction(
  _previousState: GalleryUploadState,
  formData: FormData,
): Promise<GalleryUploadState> {
  const auth = await requireTeacherAction();
  if ("error" in auth) {
    return { status: "error", message: auth.error };
  }

  const { supabase, user } = auth;
  const classId = String(formData.get("classId") || "").trim();
  const weekDate = normalizeSabbathDateInput(formData.get("weekDate"));
  const tags = normalizeGalleryPhotoTags(formData.getAll("tags"));
  const caption = normalizeCaption(formData.get("caption"));
  const files = formData.getAll("photos").filter((entry): entry is File => (
    isFileEntry(entry) && entry.size > 0
  ));

  if (!classId) {
    return { status: "error", message: "Selecione uma classe antes de enviar fotos." };
  }

  if (!weekDate) {
    return { status: "error", message: "Selecione um sábado válido." };
  }

  if (tags.length === 0) {
    return { status: "error", message: "Selecione ao menos uma tag para as fotos." };
  }

  if (files.length === 0) {
    return { status: "error", message: "Selecione ou tire ao menos uma foto." };
  }

  if (files.length > MAX_GALLERY_PHOTOS_PER_UPLOAD) {
    return {
      status: "error",
      message: `Envie no máximo ${MAX_GALLERY_PHOTOS_PER_UPLOAD} fotos por vez.`,
    };
  }

  for (const file of files) {
    const validationError = validateGalleryPhotoFile(file);
    if (validationError) {
      return { status: "error", message: validationError };
    }
  }

  const uploadedPaths: string[] = [];

  for (const file of files) {
    const storagePath = buildClassGalleryPhotoPath(classId, weekDate, file.type);

    const { error: uploadError } = await supabase.storage
      .from(CLASS_GALLERY_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      await cleanupUploadedGalleryPaths(supabase, uploadedPaths);
      console.error("Error uploading class gallery photo:", uploadError);
      return { status: "error", message: "Não foi possível enviar uma das fotos." };
    }

    uploadedPaths.push(storagePath);

    const { error: insertError } = await supabase
      .from("class_gallery_photos")
      .insert({
        class_id: classId,
        week_date: weekDate,
        storage_path: storagePath,
        original_filename: file.name || null,
        content_type: file.type,
        file_size: file.size,
        caption,
        tags,
        uploaded_by: user.id,
      });

    if (insertError) {
      await cleanupUploadedGalleryPaths(supabase, uploadedPaths);
      console.error("Error inserting class gallery photo metadata:", insertError);
      return { status: "error", message: "Não foi possível registrar uma das fotos." };
    }
  }

  revalidatePath("/relatorios/lancamento");
  revalidatePath("/responsavel/fotos");
  revalidatePath("/responsavel");

  return {
    status: "success",
    message: files.length === 1 ? "Foto enviada." : `${files.length} fotos enviadas.`,
  };
}

export async function deleteClassGalleryPhotoAction(photoId: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) {
    throw new Error(auth.error);
  }

  const { supabase } = auth;
  const { data: photo, error: fetchError } = await supabase
    .from("class_gallery_photos")
    .select("id, class_id, storage_path")
    .eq("id", photoId)
    .maybeSingle();

  if (fetchError || !photo) {
    throw new Error("Foto não encontrada.");
  }

  const { error: storageError } = await supabase.storage
    .from(CLASS_GALLERY_BUCKET)
    .remove([photo.storage_path]);

  if (storageError) {
    console.error("Error deleting class gallery photo object:", storageError);
    throw new Error("Não foi possível remover a foto.");
  }

  const { error: deleteError } = await supabase
    .from("class_gallery_photos")
    .delete()
    .eq("id", photoId);

  if (deleteError) {
    console.error("Error deleting class gallery photo metadata:", deleteError);
    throw new Error("Não foi possível concluir a remoção da foto.");
  }

  revalidatePath("/relatorios/lancamento");
  revalidatePath("/responsavel/fotos");
  revalidatePath("/responsavel");
}
