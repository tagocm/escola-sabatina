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
import {
  createGalleryAdminClient,
  decodeGalleryPhotoId,
  getClassIdFromGalleryPath,
  getGuardianClassIds,
  isActiveClassMember,
  listClassGalleryPhotos,
  listClassGalleryWeeks,
  type GalleryAdminClient,
} from "@/lib/gallery/server";
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
  galleryAdminSupabase: GalleryAdminClient,
  paths: string[],
) {
  if (paths.length === 0) return;

  await galleryAdminSupabase.storage.from(CLASS_GALLERY_BUCKET).remove(paths);
}

export async function getTeacherGalleryPhotos(classId: string, weekDate?: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return [];

  const { user } = auth;
  const galleryAdminSupabase = createGalleryAdminClient();
  if (!galleryAdminSupabase) return [];

  if (!(await isActiveClassMember(galleryAdminSupabase, user.id, classId))) {
    return [];
  }

  if (weekDate) {
    return listClassGalleryPhotos(galleryAdminSupabase, classId, weekDate);
  }

  const weekDates = await listClassGalleryWeeks(galleryAdminSupabase, classId);
  const photos = await Promise.all(
    weekDates.map((date) => listClassGalleryPhotos(galleryAdminSupabase, classId, date)),
  );

  return photos.flat() as GalleryPhotoRow[];
}

export async function getGuardianGalleryPhotos() {
  const auth = await requireGuardianAction();
  if ("error" in auth) return [];

  const { user } = auth;
  const galleryAdminSupabase = createGalleryAdminClient();
  if (!galleryAdminSupabase) return [];

  const guardianClassIds = await getGuardianClassIds(galleryAdminSupabase, user.id);
  if (guardianClassIds.length === 0) return [];

  const { data: classes } = await galleryAdminSupabase
    .from("classes")
    .select("id, name")
    .in("id", guardianClassIds);
  const classNames = new Map((classes || []).map((item) => [item.id, item.name]));
  const photosByClass = await Promise.all(
    guardianClassIds.map(async (classId) => {
      const weekDates = await listClassGalleryWeeks(galleryAdminSupabase, classId);
      const photosByWeek = await Promise.all(
        weekDates.map((date) => (
          listClassGalleryPhotos(galleryAdminSupabase, classId, date, classNames.get(classId))
        )),
      );

      return photosByWeek.flat();
    }),
  );

  return photosByClass.flat().sort((left, right) => (
    new Date(right.week_date).getTime() - new Date(left.week_date).getTime()
      || new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  )) as GalleryPhotoRow[];
}

export async function uploadClassGalleryPhotosAction(
  _previousState: GalleryUploadState,
  formData: FormData,
): Promise<GalleryUploadState> {
  const auth = await requireTeacherAction();
  if ("error" in auth) {
    return { status: "error", message: auth.error };
  }

  const { user } = auth;
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

  const galleryAdminSupabase = createGalleryAdminClient();
  if (!galleryAdminSupabase) {
    return { status: "error", message: "Upload de fotos não configurado neste ambiente." };
  }

  if (!(await isActiveClassMember(galleryAdminSupabase, user.id, classId))) {
    return { status: "error", message: "Professor não pertence à classe informada." };
  }

  const uploadedPaths: string[] = [];

  for (const file of files) {
    const storagePath = buildClassGalleryPhotoPath(classId, weekDate, file.type);

    const { error: uploadError } = await galleryAdminSupabase.storage
      .from(CLASS_GALLERY_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        metadata: {
          classId,
          weekDate,
          tags,
          caption,
          uploadedBy: user.id,
          originalFilename: file.name || null,
        },
        upsert: false,
      });

    if (uploadError) {
      await cleanupUploadedGalleryPaths(galleryAdminSupabase, uploadedPaths);
      console.error("Error uploading class gallery photo:", uploadError);
      return { status: "error", message: "Não foi possível enviar uma das fotos." };
    }

    uploadedPaths.push(storagePath);
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

  const galleryAdminSupabase = createGalleryAdminClient();
  if (!galleryAdminSupabase) {
    throw new Error("Upload de fotos não configurado neste ambiente.");
  }

  const storagePath = decodeGalleryPhotoId(photoId);
  const classId = storagePath ? getClassIdFromGalleryPath(storagePath) : null;

  if (!storagePath || !classId) {
    throw new Error("Foto não encontrada.");
  }

  if (!(await isActiveClassMember(galleryAdminSupabase, auth.user.id, classId))) {
    throw new Error("Foto não encontrada.");
  }

  const { error: storageError } = await galleryAdminSupabase.storage
    .from(CLASS_GALLERY_BUCKET)
    .remove([storagePath]);

  if (storageError) {
    console.error("Error deleting class gallery photo object:", storageError);
    throw new Error("Não foi possível remover a foto.");
  }

  revalidatePath("/relatorios/lancamento");
  revalidatePath("/responsavel/fotos");
  revalidatePath("/responsavel");
}
