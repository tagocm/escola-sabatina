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
  type GalleryPhotoTag,
} from "@/lib/gallery/sabbath";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ImageOff,
  Images,
  RefreshCcw,
  Send,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTags, setSelectedTags] = useState<GalleryPhotoTag[]>([]);
  const [caption, setCaption] = useState("");
  const [uploadState, setUploadState] = useState<GalleryUploadState>(initialUploadState);
  const [isPending, startTransition] = useTransition();

  const clearSelectedFile = useCallback(() => {
    setSelectedFile(null);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
  }, []);

  const closePanel = useCallback(() => {
    if (isPending) return;

    if (activePanel === "capture") {
      clearSelectedFile();
      setSelectedTags([]);
      setCaption("");
      setUploadState(initialUploadState);
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
    setUploadState(initialUploadState);
    cameraInputRef.current?.click();
  }

  function handleCameraChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    setSelectedFile(file);
    setUploadState(initialUploadState);
    setActivePanel("capture");
  }

  function toggleTag(tag: GalleryPhotoTag) {
    setSelectedTags((current) => (
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    ));
  }

  function handleCaptureSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setUploadState({ status: "error", message: "Tire uma foto antes de enviar." });
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.append("photos", selectedFile);

    startTransition(() => {
      void (async () => {
        try {
          const result = await uploadClassGalleryPhotosAction(initialUploadState, formData);
          setUploadState(result);

          if (result.status === "success") {
            clearSelectedFile();
            setSelectedTags([]);
            setCaption("");
            setActivePanel(null);
            router.refresh();
          }
        } catch (error) {
          console.error("Falha ao enviar foto da aula.", error);
          setUploadState({
            status: "error",
            message: "Não foi possível enviar a foto.",
          });
        }
      })();
    });
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

        <form onSubmit={handleCaptureSubmit} className="flex flex-col gap-4 overflow-y-auto p-4">
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="weekDate" value={weekDate} />

          <div className="flex items-center gap-3 border-4 border-foreground bg-surface p-3 shadow-editorial-sm">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center border-4 border-foreground bg-background">
              <Camera className="h-6 w-6 stroke-[3]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-black uppercase leading-tight">
                {selectedFile?.name || "Foto selecionada"}
              </p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] opacity-40">
                {selectedFile ? formatFileSize(selectedFile.size) : "Aguardando câmera"}
              </p>
            </div>
            <button
              type="button"
              onClick={openCamera}
              className={iconButtonClass}
              aria-label="Trocar foto"
              title="Trocar foto"
              disabled={isPending}
            >
              <RefreshCcw className="h-4 w-4 stroke-[3]" />
            </button>
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
            disabled={isPending}
          >
            <Send className="h-5 w-5 stroke-[3]" />
            {isPending ? "Enviando" : "Enviar Foto"}
          </button>

          {uploadState.status !== "idle" && uploadState.message ? (
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
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
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
