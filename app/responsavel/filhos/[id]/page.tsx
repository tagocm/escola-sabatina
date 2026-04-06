"use client";

import { useTransition, useState, useEffect } from "react";
import PolaroidPhoto from "@/components/ui/PolaroidPhoto";
import { ArrowRight, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { updateGuardianStudent } from "@/app/actions/guardians";
import PageHeader from "@/components/ui/PageHeader";
import { getStudentPhotoSrc } from "@/lib/storage/student-photos";
import {
  alertClass,
  compactInputClass,
  fieldLabelClass,
  mutedInputClass,
  primaryActionWideClass,
  secondaryActionWideClass,
  stackedPageClass,
  surfaceClass,
  surfaceSoftClass,
  textInputClass,
} from "@/components/ui/design-system";

interface Props {
  params: Promise<{ id: string }>;
}

interface StudentData {
  id: string;
  full_name: string;
  photo_url: string | null;
  birth_date: string | null;
  sex: "masculino" | "feminino";
  whatsapp: string | null;
}

export default function EditarFilhoPage({ params }: Props) {
  const [studentId, setStudentId] = useState<string>("");
  const [student, setStudent] = useState<StudentData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const previewPhotoUrl = student ? getStudentPhotoSrc(student.id, student.photo_url) : null;

  useEffect(() => {
    async function load() {
      const { id } = await params;
      setStudentId(id);

      // Fetch student data via API
      const { getGuardianStudents } = await import("@/app/actions/guardians");
      const students = await getGuardianStudents();
      const found = (students as unknown as StudentData[]).find(s => s.id === id);
      setStudent(found || null);
      setLoading(false);
    }
    load();
  }, [params]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const formData = new FormData(e.currentTarget);

    if (photoFile) {
      formData.append("photo", photoFile);
    }
    if (student?.photo_url) {
      formData.append("currentPhotoPath", student.photo_url);
    }

    startTransition(async () => {
      const result = await updateGuardianStudent(studentId, formData);
      if (result?.error) {
        setErrorMsg(result.error);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className={`${surfaceSoftClass} p-12 text-center`}>
        <p className="font-black uppercase text-xl">Filho não encontrado.</p>
      </div>
    );
  }

  return (
    <div className={stackedPageClass}>
      <PageHeader
        title="Editar Dados"
        subtitle={student.full_name}
        backHref="/responsavel/filhos"
        backLabel="Voltar aos Dependentes"
      />

      <div className={`${surfaceClass} p-6 md:p-8`}>
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
          {errorMsg && (
            <div className={alertClass}>
              <AlertTriangle className="w-6 h-6 stroke-[3]" />
              <p className="text-[11px] font-black uppercase tracking-widest">{errorMsg}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-x-10 gap-y-6 xl:grid-cols-[256px_1fr] md:gap-y-8">
            <div className="flex flex-col items-center lg:items-start">
              <PolaroidPhoto currentPhotoUrl={previewPhotoUrl} onFileChange={setPhotoFile} disabled={isPending} />
            </div>

            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 md:gap-x-8 md:gap-y-5">
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className={fieldLabelClass}>Nome Completo</label>
                  <input
                    name="fullName"
                    defaultValue={student.full_name}
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

                <div className="flex flex-col gap-2 md:col-span-2">
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

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
                <Link
                  href="/responsavel/filhos"
                  className={secondaryActionWideClass}
                >
                  DESCARTAR
                </Link>
                <button
                  type="submit"
                  disabled={isPending}
                  className={primaryActionWideClass}
                >
                  <span>{isPending ? "SALVANDO..." : "SALVAR ALTERAÇÕES"}</span>
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
      </div>
    </div>
  );
}
