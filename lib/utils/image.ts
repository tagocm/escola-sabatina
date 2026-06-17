export const STUDENT_PHOTO_MAX_SIZE = 1200;
export const STUDENT_PHOTO_QUALITY = 0.9;
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
  mimeType: string
): Promise<File> {
  return new Promise((resolve) => {
    // Retorna original se não for imagem
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Redimensiona mantendo aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file); // Fallback: sem suporte a context
          return;
        }

        // Desenha a imagem redimensionada no canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Exporta como WebP comprimido
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file); // Fallback: erro ao gerar blob
              return;
            }

            const outputType = blob.type || mimeType;
            const newFileName = getCompressedFileName(file.name, outputType);

            const newFile = new File([blob], newFileName, {
              type: outputType,
              lastModified: Date.now(),
            });

            resolve(newFile);
          },
          mimeType,
          quality
        );
      };

      img.onerror = () => {
        console.error("Falha ao carregar imagem para compressão.");
        resolve(file); // Fallback
      };
    };

    reader.onerror = () => {
      console.error("Falha ao ler arquivo para compressão.");
      resolve(file); // Fallback
    };
  });
}
