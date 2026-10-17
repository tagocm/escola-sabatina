export const STUDENT_PHOTO_MAX_SIZE = 1200;
export const STUDENT_PHOTO_QUALITY = 0.9;
// Leave room for multipart fields below the 4.5 MB hosting limit.
export const STUDENT_PHOTO_MAX_UPLOAD_BYTES = 4_000_000;
const DEFAULT_COMPRESSED_IMAGE_TYPE = "image/webp";

type ImageFileCompressor = (
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  mimeType: string
) => Promise<File>;

interface CompressImageToMaxSizeOptions {
  maxBytes: number;
  maxWidth?: number;
  maxHeight?: number;
  initialQuality?: number;
  minQuality?: number;
  qualityStep?: number;
  minScale?: number;
  scaleStep?: number;
  mimeType?: string;
}

function getCompressedFileName(fileName: string, mimeType: string) {
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/").at(-1) || "webp";
  const extlessName = fileName.replace(/\.[^/.]+$/, "") || "foto";

  return `${extlessName}.${extension}`;
}

export async function compressImage(
  file: File,
  maxWidth = STUDENT_PHOTO_MAX_SIZE,
  maxHeight = STUDENT_PHOTO_MAX_SIZE,
  quality = STUDENT_PHOTO_QUALITY,
  mimeType = DEFAULT_COMPRESSED_IMAGE_TYPE
): Promise<File> {
  return resizeImageFile(file, maxWidth, maxHeight, quality, mimeType);
}

export async function prepareStudentPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size === 0) {
    throw new Error("Selecione uma imagem válida.");
  }

  const strictCompressor: ImageFileCompressor = (image, width, height, quality, type) =>
    resizeImageFile(image, width, height, quality, type, true);
  // Always decode, including small HEIC files that the browser may not support.
  const resized = await strictCompressor(
    file, STUDENT_PHOTO_MAX_SIZE, STUDENT_PHOTO_MAX_SIZE,
    STUDENT_PHOTO_QUALITY, DEFAULT_COMPRESSED_IMAGE_TYPE,
  );
  const prepared = await compressImageToMaxSize(resized, {
    maxBytes: STUDENT_PHOTO_MAX_UPLOAD_BYTES,
  }, strictCompressor);

  if (prepared.size > STUDENT_PHOTO_MAX_UPLOAD_BYTES) {
    throw new Error("A foto ainda está muito grande. Escolha uma imagem menor que 4 MB.");
  }
  if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(prepared.type)) {
    throw new Error("Envie uma imagem JPEG, PNG, WEBP ou AVIF.");
  }
  return prepared;
}

export async function compressImageToMaxSize(
  file: File,
  options: CompressImageToMaxSizeOptions,
  compressor: ImageFileCompressor = resizeImageFile
): Promise<File> {
  const {
    maxBytes,
    maxWidth = STUDENT_PHOTO_MAX_SIZE,
    maxHeight = STUDENT_PHOTO_MAX_SIZE,
    initialQuality = STUDENT_PHOTO_QUALITY,
    minQuality = 0.5,
    qualityStep = 0.1,
    minScale = 0.4,
    scaleStep = 0.82,
    mimeType = DEFAULT_COMPRESSED_IMAGE_TYPE,
  } = options;

  if (!file.type.startsWith("image/") || file.size <= maxBytes) {
    return file;
  }

  let bestFile = file;
  let scale = 1;

  while (scale >= minScale) {
    const scaledMaxWidth = Math.max(320, Math.round(maxWidth * scale));
    const scaledMaxHeight = Math.max(320, Math.round(maxHeight * scale));
    let quality = initialQuality;

    while (quality >= minQuality) {
      const compressedFile = await compressor(
        file,
        scaledMaxWidth,
        scaledMaxHeight,
        quality,
        mimeType
      );

      if (compressedFile.size < bestFile.size) {
        bestFile = compressedFile;
      }

      if (compressedFile.size <= maxBytes) {
        return compressedFile;
      }

      quality = Number((quality - qualityStep).toFixed(2));
    }

    scale = Number((scale * scaleStep).toFixed(2));
  }

  return bestFile;
}

async function resizeImageFile(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  mimeType: string,
  strict = false,
): Promise<File> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = (output: File) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(output);
    };
    const fail = () => {
      if (settled) return;
      if (!strict) return finish(file);
      settled = true;
      clearTimeout(timeout);
      reject(new Error("Não foi possível preparar a foto. Se for HEIC/HEIF, converta para JPEG ou PNG e tente novamente."));
    };

    if (!file.type.startsWith("image/")) {
      if (strict) fail();
      else finish(file);
      return;
    }
    if (strict) timeout = setTimeout(fail, 30_000);

    try {
      const reader = new FileReader();
      reader.onerror = fail;
      reader.onabort = fail;
      reader.onload = (event) => {
        if (settled) return;
        try {
          const img = new Image();
          img.onerror = fail;
          img.onload = () => {
            if (settled) return;
            try {
              let width = img.width;
              let height = img.height;
              if (!width || !height) return fail();
              if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
              }
              const canvas = document.createElement("canvas");
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext("2d");
              if (!ctx) return fail();
              ctx.drawImage(img, 0, 0, width, height);
              canvas.toBlob((blob) => {
                if (settled) return;
                if (!blob || blob.size === 0) return fail();
                try {
                  const outputType = blob.type || mimeType;
                  finish(new File([blob], getCompressedFileName(file.name, outputType), {
                    type: outputType,
                    lastModified: Date.now(),
                  }));
                } catch {
                  fail();
                }
              }, mimeType, quality);
            } catch {
              fail();
            }
          };
          img.src = event.target?.result as string;
        } catch {
          fail();
        }
      };
      reader.readAsDataURL(file);
    } catch {
      fail();
    }
  });
}
