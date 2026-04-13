export async function compressImage(
  file: File,
  maxWidth = 400,
  maxHeight = 400,
  quality = 0.8
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

            const extlessName = file.name.replace(/\.[^/.]+$/, "");
            const newFileName = `${extlessName}.webp`;

            const newFile = new File([blob], newFileName, {
              type: "image/webp",
              lastModified: Date.now(),
            });

            resolve(newFile);
          },
          "image/webp",
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
