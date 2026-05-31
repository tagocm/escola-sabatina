"use client";

import { Ban } from "lucide-react";
import { useFormStatus } from "react-dom";
import { ButtonLoader } from "@/components/ui/AppLoader";

interface TeacherDeactivateStudentButtonProps {
  studentName: string;
}

export default function TeacherDeactivateStudentButton({
  studentName,
}: TeacherDeactivateStudentButtonProps) {
  const { pending } = useFormStatus();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const confirmed = window.confirm(
      `Deseja desativar ${studentName}? O aluno ficará inativo e poderá ser reativado depois na gestão de alunos.`
    );

    if (!confirmed) {
      event.preventDefault();
    }
  };

  return (
    <button
      type="submit"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 border-4 border-foreground bg-es-orange px-5 py-3 text-[11px] font-black uppercase tracking-widest text-foreground shadow-editorial-sm transition-all hover:translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
    >
      {pending ? <ButtonLoader size="sm" label="Desativando aluno" /> : <Ban className="h-4 w-4 stroke-[2.8]" />}
      {pending ? "Desativando" : "Desativar Aluno"}
    </button>
  );
}
