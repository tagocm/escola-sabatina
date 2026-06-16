export const CLASS_GALLERY_BUCKET = "class-gallery-photos";
export const MAX_GALLERY_PHOTO_SIZE = 5 * 1024 * 1024;
export const MAX_GALLERY_PHOTOS_PER_UPLOAD = 4;

export const GALLERY_PHOTO_TAGS = [
  { value: "ofertorio", label: "Ofertório" },
  { value: "momento_musical", label: "Momento Musical" },
  { value: "carta_missionaria", label: "Carta Missionária" },
  { value: "concurso", label: "Concurso" },
  { value: "estudo_licao", label: "Estudo da Lição" },
] as const;

export type GalleryPhotoTag = (typeof GALLERY_PHOTO_TAGS)[number]["value"];

const GALLERY_MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

const GALLERY_PHOTO_TAG_LABELS: Record<GalleryPhotoTag, string> = Object.fromEntries(
  GALLERY_PHOTO_TAGS.map((tag) => [tag.value, tag.label]),
) as Record<GalleryPhotoTag, string>;

const GALLERY_PHOTO_TAG_VALUES = new Set<string>(
  GALLERY_PHOTO_TAGS.map((tag) => tag.value),
);

function parseDateInput(value: string) {
  const raw = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;

  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function formatDateInput(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function normalizeSabbathDateInput(value: FormDataEntryValue | string | null | undefined) {
  const date = parseDateInput(String(value || ""));
  if (!date) return null;

  const daysUntilSaturday = (6 - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + daysUntilSaturday);
  date.setHours(12, 0, 0, 0);

  return formatDateInput(date);
}

export function getNextSabbathDateInput(baseDate = new Date()) {
  const date = new Date(baseDate);
  date.setHours(12, 0, 0, 0);

  const daysUntilSaturday = (6 - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + daysUntilSaturday);

  return formatDateInput(date);
}

export function formatSabbathDateLabel(value: string) {
  const date = parseDateInput(value);
  if (!date) return "Sábado";

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function getGalleryPhotoExtension(mimeType: string) {
  return GALLERY_MIME_TO_EXTENSION[mimeType] || null;
}

export function isSupportedGalleryPhotoMimeType(mimeType: string) {
  return mimeType in GALLERY_MIME_TO_EXTENSION;
}

export function validateGalleryPhotoFile(file: Pick<File, "size" | "type">) {
  if (file.size > MAX_GALLERY_PHOTO_SIZE) {
    return "Cada foto deve ter no máximo 5 MB.";
  }

  if (!isSupportedGalleryPhotoMimeType(file.type)) {
    return "Envie apenas imagens JPEG, PNG, WEBP ou AVIF.";
  }

  return null;
}

export function normalizeGalleryPhotoTags(values: Array<FormDataEntryValue | string>) {
  const tags: GalleryPhotoTag[] = [];

  for (const value of values) {
    const tag = String(value || "").trim();
    if (!GALLERY_PHOTO_TAG_VALUES.has(tag) || tags.includes(tag as GalleryPhotoTag)) {
      continue;
    }

    tags.push(tag as GalleryPhotoTag);
  }

  return tags;
}

export function formatGalleryPhotoTagLabel(tag: string) {
  return GALLERY_PHOTO_TAG_LABELS[tag as GalleryPhotoTag] || tag;
}

export function buildClassGalleryPhotoPath(classId: string, sabbathDate: string, mimeType: string) {
  const extension = getGalleryPhotoExtension(mimeType);
  if (!extension) {
    throw new Error("Unsupported gallery photo type");
  }

  return `${classId}/${sabbathDate}/${crypto.randomUUID()}.${extension}`;
}
