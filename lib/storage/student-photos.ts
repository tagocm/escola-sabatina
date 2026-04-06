const STUDENT_PHOTO_BUCKET = "student-photos";
const MAX_STUDENT_PHOTO_SIZE = 5 * 1024 * 1024;

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export function normalizeStudentPhotoPath(value: string | null | undefined) {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const marker = "/student-photos/";
    const markerIndex = trimmed.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    const pathWithQuery = trimmed.slice(markerIndex + marker.length);
    return decodeURIComponent(pathWithQuery.split("?")[0] || "");
  }

  if (trimmed.startsWith("/student-photos/")) {
    return null;
  }

  if (trimmed.startsWith(`${STUDENT_PHOTO_BUCKET}/`)) {
    return trimmed.slice(STUDENT_PHOTO_BUCKET.length + 1);
  }

  return trimmed;
}

export function getStudentPhotoSrc(studentId: string, photoPath: string | null | undefined) {
  return normalizeStudentPhotoPath(photoPath) ? `/student-photos/${studentId}` : null;
}

function getFileExtension(file: File) {
  const fromMime = MIME_TO_EXTENSION[file.type];
  if (fromMime) return fromMime;

  const nameParts = file.name.split(".");
  return nameParts.length > 1 ? nameParts.pop()?.toLowerCase() || null : null;
}

export function validateStudentPhotoFile(file: File) {
  if (file.size > MAX_STUDENT_PHOTO_SIZE) {
    return "A foto deve ter no máximo 5 MB.";
  }

  if (!(file.type in MIME_TO_EXTENSION)) {
    return "Envie uma imagem JPEG, PNG, WEBP ou AVIF.";
  }

  return null;
}

export async function uploadStudentPhoto(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  filePath: string,
  file: File,
) {
  const validationError = validateStudentPhotoFile(file);
  if (validationError) {
    return { error: validationError } as const;
  }

  const extension = getFileExtension(file);
  if (!extension) {
    return { error: "Formato de imagem inválido." } as const;
  }

  const normalizedPath = filePath.endsWith(`.${extension}`) ? filePath : `${filePath}.${extension}`;

  const { error } = await supabase.storage.from(STUDENT_PHOTO_BUCKET).upload(normalizedPath, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    return { error: "Não foi possível enviar a foto." } as const;
  }

  return { path: normalizedPath } as const;
}

export function buildTeacherStudentPhotoPath(classId: string) {
  return `${classId}/${crypto.randomUUID()}`;
}

export function buildGuardianStudentPhotoPath(userId: string) {
  return `guardians/${userId}/${crypto.randomUUID()}`;
}
