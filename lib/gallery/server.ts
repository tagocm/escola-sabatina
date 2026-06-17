import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import {
  CLASS_GALLERY_BUCKET,
  isSupportedGalleryPhotoMimeType,
} from "@/lib/gallery/sabbath";
import WebSocket from "ws";

const webSocketTransport = WebSocket as unknown as WebSocketLikeConstructor;
const SABBATH_FOLDER_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface GalleryStorageMetadata {
  tags?: unknown;
  caption?: unknown;
  classId?: unknown;
  class_id?: unknown;
  weekDate?: unknown;
  week_date?: unknown;
  uploadedBy?: unknown;
  uploaded_by?: unknown;
  originalFilename?: unknown;
  original_filename?: unknown;
}

interface GalleryStorageObject {
  name: string;
  id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: {
    size?: number;
    mimetype?: string;
    contentLength?: number;
  } | null;
}

export function createGalleryAdminClient() {
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!serviceRoleKey) return null;

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        transport: webSocketTransport,
      },
    },
  );
}

export type GalleryAdminClient = NonNullable<ReturnType<typeof createGalleryAdminClient>>;

export function encodeGalleryPhotoId(storagePath: string) {
  return Buffer.from(storagePath, "utf8").toString("base64url");
}

export function decodeGalleryPhotoId(photoId: string) {
  try {
    const storagePath = Buffer.from(photoId, "base64url").toString("utf8");
    const parts = storagePath.split("/");

    if (
      parts.length !== 3 ||
      !parts[0] ||
      !SABBATH_FOLDER_PATTERN.test(parts[1]) ||
      !parts[2]
    ) {
      return null;
    }

    return storagePath;
  } catch {
    return null;
  }
}

export function getClassIdFromGalleryPath(storagePath: string) {
  return storagePath.split("/")[0] || null;
}

function getMetadataText(metadata: GalleryStorageMetadata, camelKey: keyof GalleryStorageMetadata, snakeKey: keyof GalleryStorageMetadata) {
  const value = metadata[camelKey] ?? metadata[snakeKey];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getMetadataTags(metadata: GalleryStorageMetadata) {
  if (Array.isArray(metadata.tags)) {
    return metadata.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
  }

  if (typeof metadata.tags === "string" && metadata.tags.trim()) {
    return metadata.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  }

  return [];
}

export async function isActiveClassMember(
  supabase: GalleryAdminClient,
  userId: string,
  classId: string,
) {
  const { data, error } = await supabase
    .from("class_members")
    .select("id")
    .eq("class_id", classId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  return !error && Boolean(data);
}

export async function getGuardianClassIds(supabase: GalleryAdminClient, userId: string) {
  const { data: guardianRows, error: guardianError } = await supabase
    .from("guardian_students")
    .select("student_id")
    .eq("guardian_id", userId);

  if (guardianError || !guardianRows || guardianRows.length === 0) {
    return [];
  }

  const studentIds = guardianRows
    .map((row) => row.student_id)
    .filter((studentId): studentId is string => Boolean(studentId));

  if (studentIds.length === 0) return [];

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("class_id")
    .in("id", studentIds)
    .eq("is_active", true);

  if (studentsError || !students) return [];

  return Array.from(new Set(
    students
      .map((student) => student.class_id)
      .filter((classId): classId is string => Boolean(classId)),
  ));
}

export async function listClassGalleryPhotos(
  supabase: GalleryAdminClient,
  classId: string,
  weekDate: string,
  className?: string | null,
) {
  const { data: objects, error } = await supabase.storage
    .from(CLASS_GALLERY_BUCKET)
    .list(`${classId}/${weekDate}`, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });

  if (error || !objects) return [];

  const photos = await Promise.all(
    (objects as GalleryStorageObject[])
      .filter((object) => object.name && object.id)
      .map(async (object) => {
        const storagePath = `${classId}/${weekDate}/${object.name}`;
        const { data: info } = await supabase.storage
          .from(CLASS_GALLERY_BUCKET)
          .info(storagePath);
        const metadata = (info?.metadata || {}) as GalleryStorageMetadata;
        const contentType = info?.contentType || object.metadata?.mimetype || "application/octet-stream";

        return {
          id: encodeGalleryPhotoId(storagePath),
          class_id: classId,
          week_date: weekDate,
          storage_path: storagePath,
          original_filename: getMetadataText(metadata, "originalFilename", "original_filename") || object.name,
          content_type: isSupportedGalleryPhotoMimeType(contentType) ? contentType : "image/webp",
          file_size: info?.size || object.metadata?.size || object.metadata?.contentLength || 0,
          tags: getMetadataTags(metadata),
          caption: getMetadataText(metadata, "caption", "caption"),
          created_at: info?.createdAt || object.created_at || object.updated_at || new Date(0).toISOString(),
          classes: className ? { name: className } : undefined,
        };
      }),
  );

  return photos.sort((left, right) => (
    new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  ));
}

export async function listClassGalleryWeeks(supabase: GalleryAdminClient, classId: string) {
  const { data, error } = await supabase.storage
    .from(CLASS_GALLERY_BUCKET)
    .list(classId, {
      limit: 100,
      sortBy: { column: "name", order: "desc" },
    });

  if (error || !data) return [];

  return data
    .map((item) => item.name)
    .filter((name): name is string => SABBATH_FOLDER_PATTERN.test(name));
}

export async function canAccessClassGalleryPhoto(
  supabase: GalleryAdminClient,
  userId: string,
  classId: string,
) {
  if (await isActiveClassMember(supabase, userId, classId)) {
    return true;
  }

  const guardianClassIds = await getGuardianClassIds(supabase, userId);
  return guardianClassIds.includes(classId);
}
