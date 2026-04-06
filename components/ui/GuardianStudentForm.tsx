"use client";

import { useTransition, useState } from "react";
import PolaroidPhoto from "@/components/ui/PolaroidPhoto";
import { ArrowRight, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { createGuardianStudent } from "@/app/actions/guardians";
import {
  alertClass,
  compactInputClass,
  fieldLabelAccentClass,
  fieldLabelClass,
  mutedInputClass,
  primaryActionWideClass,
  secondaryActionWideClass,
  textInputClass,
} from "@/components/ui/design-system";

interface Class {
  id: string;
  name: string;
}

export default function GuardianStudentForm({ 
  classes, 
  defaultWhatsapp 
}: { 
  classes: Class[]; 
  defaultWhatsapp?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const formData = new FormData(e.currentTarget);

    if (photoFile) {
      formData.append("photo", photoFile);
    }

    startTransition(async () => {
      const result = await createGuardianStudent(formData);
      if (result?.error) {
        setErrorMsg(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
      {errorMsg && (
        <div className={alertClass}>
          <AlertTriangle className="w-6 h-6 stroke-[3]" />
          <p className="text-[11px] font-black uppercase tracking-widest">{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-10 gap-y-6 xl:grid-cols-[256px_1fr] md:gap-y-8">
        {/* Photo Column */}
        <div className="flex flex-col items-center lg:items-start">
          <PolaroidPhoto onFileChange={setPhotoFile} disabled={isPending} />
        </div>

        {/* Fields Column */}
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 md:gap-x-8 md:gap-y-5">
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className={fieldLabelClass}>Nome Completo</label>
              <input
                name="fullName"
                required
                disabled={isPending}
                className={textInputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className={fieldLabelAccentClass}>Data de Nascimento</label>
              <input
                name="birthDate"
                type="date"
                required
                disabled={isPending}
                className={compactInputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className={fieldLabelClass}>Sexo</label>
              <select
                name="sex"
                defaultValue="masculino"
                required
                disabled={isPending}
                className={`${compactInputClass} appearance-none`}
              >
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className={fieldLabelAccentClass}>WhatsApp do Responsável</label>
              <input
                name="whatsapp"
                required
                disabled={isPending}
                defaultValue={defaultWhatsapp || ""}
                placeholder="(00) 00000-0000"
                className={mutedInputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className={fieldLabelClass}>Classe de Matrícula</label>
              <select
                name="classId"
                required
                disabled={isPending}
                className={`${compactInputClass} appearance-none font-black`}
              >
                <option value="">Selecione uma classe...</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/responsavel"
              className={secondaryActionWideClass}
            >
              DESCARTAR
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className={primaryActionWideClass}
            >
              <span>{isPending ? "SALVANDO..." : "CADASTRAR FILHO"}</span>
              {isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ArrowRight className="w-6 h-6 group-active:translate-x-1 transition-transform stroke-[3]" />
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
