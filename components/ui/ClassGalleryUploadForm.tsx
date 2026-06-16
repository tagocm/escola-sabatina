"use client";

import { uploadClassGalleryPhotosAction, type GalleryUploadState } from "@/app/actions/gallery";
import {
  fieldLabelClass,
  primaryActionCenteredBlockClass,
  secondaryActionClass,
  statusMessageClass,
  textInputClass,
} from "@/components/ui/design-system";
import { GALLERY_PHOTO_TAGS, MAX_GALLERY_PHOTOS_PER_UPLOAD, type GalleryPhotoTag } from "@/lib/gallery/sabbath";
import { AlertTriangle, CalendarDays, Camera, CheckCircle2, Images, Send, Tag } from "lucide-react";
import { useActionState, useRef, useState } from "react";

interface ClassGalleryUploadFormProps {
  classId: string;
  defaultWeekDate: string;
  lockWeekDate?: boolean;
}

const initialState: GalleryUploadState = { status: "idle" };

export default function ClassGalleryUploadForm({
  classId,
  defaultWeekDate,
  lockWeekDate = false,
}: ClassGalleryUploadFormProps) {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<GalleryPhotoTag[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const rollInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, isPending] = useActionState(
    async (previousState: GalleryUploadState, formData: FormData) => {
      const result = await uploadClassGalleryPhotosAction(previousState, formData);

      if (result.status === "success") {
        formRef.current?.reset();
        setSelectedFiles([]);
      }

      return result;
    },
    initialState,
  );

  function handleFileChange(source: "roll" | "camera") {
    const activeInput = source === "roll" ? rollInputRef.current : cameraInputRef.current;
    const inactiveInput = source === "roll" ? cameraInputRef.current : rollInputRef.current;
    const files = Array.from(activeInput?.files || []);

    if (inactiveInput) inactiveInput.value = "";
    setSelectedFiles(files.map((file) => file.name));
  }

  function toggleTag(tag: GalleryPhotoTag) {
    setSelectedTags((current) => (
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    ));
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-4 border-4 border-foreground bg-surface p-4 shadow-editorial md:grid-cols-[minmax(180px,240px)_1fr] md:gap-5 md:p-6"
    >
      <input type="hidden" name="classId" value={classId} />
      {lockWeekDate ? <input type="hidden" name="weekDate" value={defaultWeekDate} /> : null}

      {!lockWeekDate ? (
        <div className="flex flex-col gap-2">
          <label className={fieldLabelClass} htmlFor="gallery-week-date">
            Sábado
          </label>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 stroke-[3] opacity-40" />
            <input
              id="gallery-week-date"
              name="weekDate"
              type="date"
              defaultValue={defaultWeekDate}
              className={`${textInputClass} pl-11`}
              disabled={isPending}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <span className={fieldLabelClass}>Sábado</span>
          <div className="flex h-12 items-center gap-3 border-4 border-foreground bg-background px-4 text-[11px] font-black uppercase tracking-[0.16em] md:h-11">
            <CalendarDays className="h-4 w-4 stroke-[3] opacity-40" />
            <span>{defaultWeekDate.split("-").reverse().join("/")}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className={fieldLabelClass} htmlFor="gallery-caption">
          Legenda opcional
        </label>
        <input
          id="gallery-caption"
          name="caption"
          type="text"
          maxLength={140}
          placeholder="ATIVIDADE, PASSEIO, MOMENTO..."
          className={textInputClass}
          disabled={isPending}
        />
      </div>

      <div className="flex flex-col gap-3 md:col-span-2">
        <fieldset className="flex flex-col gap-2">
          <legend className={fieldLabelClass}>Tags</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label
            htmlFor="gallery-camera-input"
            className={`${secondaryActionClass} min-h-14 cursor-pointer gap-3 ${isPending ? "pointer-events-none opacity-60" : ""}`}
          >
            <Camera className="h-5 w-5 stroke-[3]" />
            Tirar Foto
          </label>
          <input
            ref={cameraInputRef}
            id="gallery-camera-input"
            name="photos"
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={isPending}
            onChange={() => handleFileChange("camera")}
          />

          <label
            htmlFor="gallery-roll-input"
            className={`${secondaryActionClass} min-h-14 cursor-pointer gap-3 ${isPending ? "pointer-events-none opacity-60" : ""}`}
          >
            <Images className="h-5 w-5 stroke-[3]" />
            Selecionar Fotos
          </label>
          <input
            ref={rollInputRef}
            id="gallery-roll-input"
            name="photos"
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={isPending}
            onChange={() => handleFileChange("roll")}
          />
        </div>

        {selectedFiles.length > 0 && (
          <div className="border-4 border-dashed border-foreground bg-background p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-40">
              {selectedFiles.length}/{MAX_GALLERY_PHOTOS_PER_UPLOAD} selecionada(s)
            </p>
            <p className="mt-1 truncate text-[11px] font-bold uppercase">
              {selectedFiles.join(" · ")}
            </p>
          </div>
        )}

        <button
          type="submit"
          className={primaryActionCenteredBlockClass}
          disabled={isPending}
        >
          <Send className="h-5 w-5 stroke-[3]" />
          {isPending ? "Enviando" : "Enviar Fotos"}
        </button>

        {state.status !== "idle" && state.message && (
          <div className={`${statusMessageClass} ${state.status === "success" ? "bg-es-green" : "bg-danger text-surface"}`}>
            {state.status === "success" ? (
              <CheckCircle2 className="h-4 w-4 stroke-[3]" />
            ) : (
              <AlertTriangle className="h-4 w-4 stroke-[3]" />
            )}
            <span>{state.message}</span>
          </div>
        )}
      </div>
    </form>
  );
}
