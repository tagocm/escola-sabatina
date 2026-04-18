"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Loader2, UserCircle, X } from "lucide-react";
import { upsertStudentInlineAction } from "@/app/actions/students";
import { getStudentPhotoSrc } from "@/lib/storage/student-photos";
import { compressImage } from "@/lib/utils/image";
import {
  alertClass,
  compactInputClass,
  fieldLabelClass,
  mutedInputClass,
  primaryActionCenteredClass,
  secondaryActionClass,
  textInputClass,
} from "@/components/ui/design-system";

interface AttendanceStudentEditModalProps {
  student: {
    id: string;
    class_id: string;
    full_name: string;
    photo_url: string | null;
    birth_date: string | null;
    sex: "masculino" | "feminino";
    guardian_name: string | null;
    whatsapp: string | null;
  };
  onClose: () => void;
}

export default function AttendanceStudentEditModal({
  student,
  onClose,
}: AttendanceStudentEditModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(() =>
    getStudentPhotoSrc(student.id, student.photo_url),
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const safeClose = () => {
    if (!isPending) onClose();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    if (!selectedFile) return;

    try {
      const compressedFile = await compressImage(selectedFile, 400, 400, 0.85);
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
      previewObjectUrlRef.current = URL.createObjectURL(compressedFile);
      setPhotoFile(compressedFile);
      setPreviewSrc(previewObjectUrlRef.current);
    } catch (error) {
      console.error("Falha ao preparar foto do aluno.", error);
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
      previewObjectUrlRef.current = URL.createObjectURL(selectedFile);
      setPhotoFile(selectedFile);
      setPreviewSrc(previewObjectUrlRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);

    const formData = new FormData(event.currentTarget);
    if (photoFile) {
      formData.append("photo", photoFile);
    }
    if (student.photo_url) {
      formData.append("currentPhotoPath", student.photo_url);
    }

    startTransition(async () => {
      const result = await upsertStudentInlineAction(student.id, formData);
      if (result?.error) {
        setErrorMsg(result.error);
        return;
      }

      router.refresh();
      onClose();
    });
  };

  const modal = (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-foreground/35 p-3 backdrop-blur-[2px] md:items-center md:p-4">
      <button
        type="button"
        aria-label="Fechar janela do aluno"
        className="absolute inset-0"
        onClick={safeClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Editar cadastro de ${student.full_name}`}
        className="relative z-10 flex max-h-[90svh] w-full max-w-xl flex-col overflow-hidden border-4 border-foreground bg-[#FFFCEE] shadow-editorial"
      >
        <div className="flex items-start justify-between gap-4 border-b-4 border-foreground px-4 py-4 md:px-5 md:py-4">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
              Cadastro do aluno
            </span>
            <h3 className="text-lg font-black uppercase tracking-tight md:text-xl">
              {student.full_name}
            </h3>
          </div>

          <button
            type="button"
            onClick={safeClose}
            className="flex h-10 w-10 items-center justify-center border-4 border-foreground bg-white shadow-editorial-sm"
            aria-label="Fechar"
          >
            <X className="h-4 w-4 stroke-[3]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 overflow-y-auto p-4 md:p-5">
          {errorMsg ? (
            <div className={alertClass}>
              <p className="text-[10px] font-black uppercase tracking-[0.18em]">{errorMsg}</p>
            </div>
          ) : null}

          <input type="hidden" name="classId" value={student.class_id} />

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden border-4 border-foreground bg-white shadow-editorial-sm"
            >
              {previewSrc ? (
                <Image
                  src={previewSrc}
                  alt={student.full_name}
                  fill
                  unoptimized
                  sizes="96px"
                  className="object-cover"
                />
              ) : (
                <UserCircle className="h-12 w-12 opacity-20" />
              )}
            </button>

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className={fieldLabelClass}>Foto do aluno</span>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex h-11 items-center justify-center gap-2 border-4 border-foreground bg-white px-4 text-[10px] font-black uppercase tracking-[0.18em] shadow-editorial-sm"
              >
                <Camera className="h-4 w-4 stroke-[3]" />
                {previewSrc ? "Trocar foto" : "Adicionar foto"}
              </button>
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] opacity-40">
                Toque na imagem ou no botão
              </span>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className={fieldLabelClass}>Nome do aluno</label>
              <input
                name="fullName"
                defaultValue={student.full_name}
                required
                disabled={isPending}
                className={textInputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className={fieldLabelClass}>Nascimento</label>
              <input
                name="birthDate"
                type="date"
                defaultValue={student.birth_date || ""}
                disabled={isPending}
                className={compactInputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className={fieldLabelClass}>Sexo</label>
              <select
                name="sex"
                defaultValue={student.sex}
                disabled={isPending}
                className={`${compactInputClass} appearance-none`}
              >
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
              </select>
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className={fieldLabelClass}>Responsável</label>
              <input
                name="guardianName"
                defaultValue={student.guardian_name || ""}
                disabled={isPending}
                className={compactInputClass}
              />
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className={fieldLabelClass}>WhatsApp</label>
              <input
                name="whatsapp"
                defaultValue={student.whatsapp || ""}
                disabled={isPending}
                placeholder="(00) 00000-0000"
                className={mutedInputClass}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t-4 border-foreground/10 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={safeClose}
              className={secondaryActionClass}
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={primaryActionCenteredClass}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando
                </>
              ) : (
                "Salvar cadastro"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(modal, document.body);
}
