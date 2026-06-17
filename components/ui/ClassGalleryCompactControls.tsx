"use client";

import {
  deleteClassGalleryPhotoAction,
  uploadClassGalleryPhotosAction,
  type GalleryUploadState,
} from "@/app/actions/gallery";
import {
  bottomSheetClass,
  compactInputClass,
  fieldLabelClass,
  iconButtonClass,
  modalOverlayClass,
  modalPanelClass,
  primaryActionCenteredClass,
  statusBadgeClass,
  statusMessageClass,
} from "@/components/ui/design-system";
import {
  formatGalleryPhotoTagLabel,
  GALLERY_PHOTO_TAGS,
  MAX_GALLERY_PHOTOS_PER_UPLOAD,
  type GalleryPhotoTag,
} from "@/lib/gallery/sabbath";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ImageOff,
  Images,
  Plus,
  Send,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ClassGalleryCompactPhoto {
  id: string;
  week_date: string;
  original_filename: string | null;
  tags: string[];
  caption: string | null;
  created_at: string;
}

interface ClassGalleryCompactControlsProps {
  classId: string;
  weekDate: string;
  sabbathLabel: string;
  photos: ClassGalleryCompactPhoto[];
}

type ActivePanel = "capture" | "gallery" | null;

const initialUploadState: GalleryUploadState = { status: "idle" };

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ClassGalleryCompactControls({
  classId,
  weekDate,
  sabbathLabel,
  photos,
}: ClassGalleryCompactControlsProps) {
  const router = useRouter();
  const captureFormId = useId();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedTags, setSelectedTags] = useState<GalleryPhotoTag[]>([]);
  const [caption, setCaption] = useState("");
  const [showUploadMessage, setShowUploadMessage] = useState(false);
  const clearSelectedFile = useCallback(() => {
    setSelectedFiles([]);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
  }, []);
  const selectedPhotoCount = selectedFiles.length;
  const [uploadState, formAction, isPending] = useActionState(
    async (previousState: GalleryUploadState, formData: FormData) => {
      try {
        const result = await uploadClassGalleryPhotosAction(previousState, formData);

        if (result.status === "success") {
          clearSelectedFile();
          setSelectedTags([]);
          setCaption("");
          setShowUploadMessage(false);
          setActivePanel(null);
          router.refresh();
        } else {
          setShowUploadMessage(true);
        }

        return result;
      } catch (error) {
        console.error("Falha ao enviar foto da aula.", error);
        setShowUploadMessage(true);
        return {
          status: "error",
          message: "Não foi possível enviar a foto.",
        } satisfies GalleryUploadState;
      }
    },
    initialUploadState,
  );
  const canAddPhoto = selectedPhotoCount < MAX_GALLERY_PHOTOS_PER_UPLOAD && !isPending;

  function syncCameraInputFiles(files: File[]) {
    if (!cameraInputRef.current) return;

    const dataTransfer = new DataTransfer();
    files.forEach((file) => dataTransfer.items.add(file));
    cameraInputRef.current.files = dataTransfer.files;
  }

  const closePanel = useCallback(() => {
    if (isPending) return;

    if (activePanel === "capture") {
      clearSelectedFile();
      setSelectedTags([]);
      setCaption("");
      setShowUploadMessage(false);
    }

    setActivePanel(null);
  }, [activePanel, clearSelectedFile, isPending]);

  useEffect(() => {
    if (!activePanel) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePanel, closePanel]);

  function openCamera() {
    if (!canAddPhoto) return;

    setShowUploadMessage(false);
    cameraInputRef.current?.click();
  }

  function handleCameraChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setShowUploadMessage(false);
    const nextFiles = [...selectedFiles, ...files].slice(0, MAX_GALLERY_PHOTOS_PER_UPLOAD);
    setSelectedFiles(nextFiles);
    syncCameraInputFiles(nextFiles);
    setActivePanel("capture");
  }

  function removeSelectedFile(index: number) {
    const nextFiles = selectedFiles.filter((_, fileIndex) => fileIndex !== index);
    setSelectedFiles(nextFiles);
    syncCameraInputFiles(nextFiles);
    setShowUploadMessage(false);
  }

  function toggleTag(tag: GalleryPhotoTag) {
    setSelectedTags((current) => (
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    ));
  }

  const captureDialog = activePanel === "capture" ? (
    <div className={modalOverlayClass}>
      <button
        type="button"
        aria-label="Fechar envio de foto"
        className="absolute inset-0"
        onClick={closePanel}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-gallery-capture-title"
        className={modalPanelClass}
      >
        <div className="flex items-start justify-between gap-3 border-b-4 border-foreground bg-surface px-4 py-3">
          <div className="min-w-0">
            <span className="block truncate text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
              {sabbathLabel}
            </span>
            <h3
              id="class-gallery-capture-title"
              className="mt-1 text-lg font-black uppercase leading-none tracking-tight"
            >
              Nova foto
            </h3>
          </div>

          <button
            type="button"
            onClick={closePanel}
            className={iconButtonClass}
            aria-label="Fechar"
            disabled={isPending}
          >
            <X className="h-4 w-4 stroke-[3]" />
          </button>
        </div>

        <form
          id={captureFormId}
          action={formAction}
          className="flex flex-col gap-4 overflow-y-auto p-4"
        >
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="weekDate" value={weekDate} />

          <div className="flex flex-col gap-3 border-4 border-foreground bg-surface p-3 shadow-editorial-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center border-4 border-foreground bg-background">
                <Images className="h-6 w-6 stroke-[3]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-black uppercase leading-tight">
                  {selectedPhotoCount}/{MAX_GALLERY_PHOTOS_PER_UPLOAD} foto(s) no envio
                </p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] opacity-40">
                  Carregue todas antes de enviar
                </p>
              </div>
              <button
                type="button"
                onClick={openCamera}
                className="flex h-11 shrink-0 items-center justify-center gap-2 border-4 border-foreground bg-surface px-3 text-[10px] font-black uppercase tracking-[0.14em] shadow-editorial-sm transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Adicionar outra foto"
                title="Adicionar outra foto"
                disabled={!canAddPhoto}
              >
                <Plus className="h-4 w-4 stroke-[3]" />
                <span className="hidden sm:inline">Adicionar</span>
              </button>
            </div>

            {selectedFiles.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${file.size}-${index}`}
                    className="grid grid-cols-[36px_minmax(0,1fr)_36px] items-center gap-2 border-2 border-foreground bg-background px-2 py-2"
                  >
                    <div className="flex h-8 w-8 items-center justify-center border-2 border-foreground bg-surface text-[10px] font-black">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-black uppercase leading-tight">
                        {file.name || "Foto selecionada"}
                      </p>
                      <p className="mt-0.5 text-[8px] font-black uppercase tracking-[0.16em] opacity-40">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSelectedFile(index)}
                      className="flex h-8 w-8 items-center justify-center border-2 border-foreground bg-surface transition-colors hover:bg-danger hover:text-surface"
                      aria-label={`Remover foto ${index + 1}`}
                      disabled={isPending}
                    >
                      <X className="h-3.5 w-3.5 stroke-[3]" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={openCamera}
                className="flex min-h-11 items-center justify-center gap-2 border-4 border-foreground bg-background px-4 text-[10px] font-black uppercase tracking-[0.16em] shadow-editorial-sm"
                disabled={!canAddPhoto}
              >
                <Camera className="h-4 w-4 stroke-[3]" />
                Carregar foto
              </button>
            )}
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className={fieldLabelClass}>Tags</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {GALLERY_PHOTO_TAGS.map((tag) => {
                const checked = selectedTags.includes(tag.value);

                return (
                  <label
                    key={tag.value}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 border-4 border-foreground px-3 py-2 text-[10px] font-black uppercase leading-tight tracking-[0.12em] shadow-editorial-sm transition-all ${
                      checked ? "bg-es-yellow" : "bg-surface hover:bg-background"
                    } ${isPending ? "pointer-events-none opacity-60" : ""}`}
                  >
                    <input
                      type="checkbox"
                      name="tags"
                      value={tag.value}
                      checked={checked}
                      disabled={isPending}
                      onChange={() => toggleTag(tag.value)}
                      className="sr-only"
                    />
                    <Tag className="h-3.5 w-3.5 shrink-0 stroke-[3]" />
                    <span>{tag.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="flex flex-col gap-2">
            <span className={fieldLabelClass}>Legenda opcional</span>
            <input
              name="caption"
              type="text"
              maxLength={140}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="ATIVIDADE, MOMENTO..."
              className={compactInputClass}
              disabled={isPending}
            />
          </label>

          <button
            type="submit"
            className={primaryActionCenteredClass}
            disabled={isPending || selectedPhotoCount === 0}
          >
            <Send className="h-5 w-5 stroke-[3]" />
            {isPending ? "Enviando" : selectedPhotoCount === 1 ? "Enviar Foto" : "Enviar Fotos"}
          </button>

          {showUploadMessage && uploadState.status !== "idle" && uploadState.message ? (
            <div className={`${statusMessageClass} ${uploadState.status === "success" ? "bg-es-green" : "bg-danger text-surface"}`}>
              {uploadState.status === "success" ? (
                <CheckCircle2 className="h-4 w-4 stroke-[3]" />
              ) : (
                <AlertTriangle className="h-4 w-4 stroke-[3]" />
              )}
              <span>{uploadState.message}</span>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  ) : null;

  const galleryDialog = activePanel === "gallery" ? (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-foreground/45 p-0 backdrop-blur-[3px] sm:items-center sm:p-5">
      <button
        type="button"
        aria-label="Fechar galeria da aula"
        className="absolute inset-0 cursor-default"
        onClick={closePanel}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-gallery-list-title"
        className={bottomSheetClass}
      >
        <div className="mx-auto mt-3 h-1.5 w-16 shrink-0 bg-foreground/20 sm:hidden" />

        <div className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-3 border-b-4 border-foreground bg-surface px-4 py-4">
          <div className="min-w-0">
            <span className="block truncate text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
              {sabbathLabel}
            </span>
            <h3
              id="class-gallery-list-title"
              className="mt-1 text-lg font-black uppercase leading-none tracking-tight"
            >
              Galeria da aula
            </h3>
          </div>

          <button
            type="button"
            onClick={closePanel}
            className={iconButtonClass}
            aria-label="Fechar"
          >
            <X className="h-5 w-5 stroke-[3]" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          {photos.length === 0 ? (
            <div className="flex min-h-36 flex-col items-center justify-center border-4 border-dashed border-foreground/30 bg-surface px-5 py-6 text-center">
              <ImageOff className="h-10 w-10 stroke-[1.5] opacity-20" />
              <p className="mt-3 text-[11px] font-black uppercase tracking-tight opacity-40">
                Nenhuma foto neste sábado
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {photos.map((photo) => (
                <article
                  key={photo.id}
                  className="relative overflow-hidden border-4 border-foreground bg-surface shadow-editorial-sm"
                >
                  <form
                    action={deleteClassGalleryPhotoAction.bind(null, photo.id)}
                    className="absolute right-2 top-2 z-10"
                  >
                    <button
                      type="submit"
                      className="flex h-10 w-10 items-center justify-center border-4 border-foreground bg-surface shadow-editorial-sm transition-all hover:bg-danger hover:text-surface active:translate-x-0.5 active:translate-y-0.5"
                      title="Remover foto"
                      aria-label="Remover foto"
                    >
                      <Trash2 className="h-4 w-4 stroke-[3]" />
                    </button>
                  </form>

                  <div className="relative aspect-[4/3] w-full overflow-hidden border-b-4 border-foreground bg-background">
                    <Image
                      src={`/galeria/fotos/${photo.id}`}
                      alt={photo.caption || photo.tags.map(formatGalleryPhotoTagLabel).join(", ") || "Foto da aula"}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 100vw, 320px"
                      className="object-cover"
                    />
                  </div>

                  <div className="flex min-h-24 flex-col gap-3 p-3">
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
                      <Camera className="h-3.5 w-3.5 stroke-[3]" />
                      {new Date(photo.created_at).toLocaleDateString("pt-BR")}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {photo.tags.map((tag) => (
                        <span key={tag} className={`${statusBadgeClass} bg-es-yellow`}>
                          <Tag className="h-3 w-3 stroke-[3]" />
                          {formatGalleryPhotoTagLabel(tag)}
                        </span>
                      ))}
                    </div>
                    {photo.caption ? (
                      <p className="line-clamp-2 text-[11px] font-bold uppercase leading-tight opacity-60">
                        {photo.caption}
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="flex items-center gap-2">
        <input
          ref={cameraInputRef}
          name="photos"
          form={captureFormId}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={isPending}
          onChange={handleCameraChange}
        />

        <button
          type="button"
          onClick={openCamera}
          className={iconButtonClass}
          aria-label="Abrir câmera para foto da aula"
          title="Abrir câmera"
        >
          <Camera className="h-5 w-5 stroke-[3]" />
        </button>

        <button
          type="button"
          onClick={() => setActivePanel("gallery")}
          className={`${iconButtonClass} relative`}
          aria-label={`Abrir galeria de fotos da aula com ${photos.length} foto(s)`}
          title="Abrir galeria"
        >
          <Images className="h-5 w-5 stroke-[3]" />
          {photos.length > 0 ? (
            <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center border-2 border-foreground bg-es-yellow px-1 text-[9px] font-black leading-none shadow-editorial-sm">
              {photos.length}
            </span>
          ) : null}
        </button>
      </div>

      {typeof document !== "undefined" && captureDialog
        ? createPortal(captureDialog, document.body)
        : null}
      {typeof document !== "undefined" && galleryDialog
        ? createPortal(galleryDialog, document.body)
        : null}
    </>
  );
}
