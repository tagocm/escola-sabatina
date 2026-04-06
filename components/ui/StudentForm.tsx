"use client";

import { useTransition, useState } from "react";
import PolaroidPhoto from "./PolaroidPhoto";
import { ArrowRight, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { upsertStudentAction } from "@/app/actions/students";
import { getStudentPhotoSrc } from "@/lib/storage/student-photos";
import {
  alertClass,
  compactInputClass,
  fieldLabelClass,
  mutedInputClass,
  primaryActionWideClass,
  secondaryActionWideClass,
  textInputClass,
} from "@/components/ui/design-system";

interface StudentFormProps {
  classes: {
    id: string;
    name: string;
    is_active?: boolean;
  }[];
  defaultClassId?: string;
  initialData?: {
    id: string;
    full_name: string;
    photo_url: string | null;
    birth_date: string | null;
    sex: "masculino" | "feminino";
    guardian_name: string | null;
    whatsapp: string | null;
    class_id: string;
  };
}

export default function StudentForm({ classes = [], defaultClassId, initialData }: StudentFormProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const availableClasses = Array.isArray(classes) ? classes : [];
  const previewPhotoUrl = initialData ? getStudentPhotoSrc(initialData.id, initialData.photo_url) : null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const formData = new FormData(e.currentTarget);
    
    // Add photo file to form data if selected
    if (photoFile) {
      formData.append("photo", photoFile);
    }
    
    // Add current photo url if editing
    if (initialData?.photo_url) {
      formData.append("currentPhotoPath", initialData.photo_url);
    }

    startTransition(async () => {
      const result = await upsertStudentAction(initialData?.id, formData);
      if (result?.error) {
        setErrorMsg(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
      {errorMsg && (
        <div className={alertClass}>
          <AlertTriangle className="w-6 h-6 stroke-[3]" />
          <p className="text-[11px] font-black uppercase tracking-widest">{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-10 gap-y-6 xl:grid-cols-[256px_1fr] md:gap-y-8">
        <div className="flex flex-col items-center lg:items-start">
          <PolaroidPhoto 
            currentPhotoUrl={previewPhotoUrl} 
            onFileChange={setPhotoFile} 
            disabled={isPending}
          />
        </div>

        <div className="flex flex-col gap-6 md:gap-8">
           <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 md:gap-x-8 md:gap-y-5">
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className={fieldLabelClass}>Nome do Aluno</label>
                <input 
                  name="fullName" 
                  defaultValue={initialData?.full_name} 
                  required 
                  disabled={isPending}
                  className={textInputClass} 
                />
              </div>

              <div className="flex flex-col gap-2">
                 <label className={fieldLabelClass}>Data de Nascimento</label>
                 <input 
                   name="birthDate" 
                   type="date" 
                   defaultValue={initialData?.birth_date || ""} 
                   disabled={isPending}
                   className={compactInputClass} 
                 />
              </div>

              <div className="flex flex-col gap-2">
                 <label className={fieldLabelClass}>Sexo</label>
                 <select 
                   name="sex" 
                   defaultValue={initialData?.sex || "masculino"} 
                   disabled={isPending}
                   className={`${compactInputClass} appearance-none`}
                 >
                    <option value="masculino">Masculino</option>
                    <option value="feminino">Feminino</option>
                 </select>
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <label className={fieldLabelClass}>Classe</label>
                <select
                  name="classId"
                  defaultValue={initialData?.class_id ?? defaultClassId}
                  disabled={isPending}
                  className={`${compactInputClass} appearance-none`}
                >
                  {availableClasses
                    .filter((cls) => cls.is_active !== false)
                    .map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <label className={fieldLabelClass}>Nome do Responsável</label>
                <input 
                  name="guardianName" 
                  defaultValue={initialData?.guardian_name || ""} 
                  disabled={isPending}
                  className={compactInputClass} 
                />
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <label className={fieldLabelClass}>WhatsApp</label>
                <input 
                  name="whatsapp" 
                  defaultValue={initialData?.whatsapp || ""} 
                  disabled={isPending}
                  placeholder="(00) 00000-0000"
                  className={mutedInputClass} 
                />
              </div>
           </div>

           <div className="border-t-4 border-foreground/15 pt-6">
             <div className="flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
              <Link 
                href="/alunos"
                className={secondaryActionWideClass}
              >
                DESCARTAR
              </Link>
              <button
                type="submit"
                disabled={isPending}
                className={primaryActionWideClass}
              >
                <span>{isPending ? "SALVANDO..." : "REGISTRAR ALUNO"}</span>
                {isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                   <ArrowRight className="w-6 h-6 group-active:translate-x-1 transition-transform stroke-[3]" />
                )}
              </button>
             </div>
           </div>
        </div>
      </div>
    </form>
  );
}
