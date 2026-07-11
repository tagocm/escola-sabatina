"use client";

import { Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { ButtonLoader } from "@/components/ui/AppLoader";

interface DeactivateStudentButtonProps {
  studentName: string;
}

export default function DeactivateStudentButton({
  studentName,
}: DeactivateStudentButtonProps) {
  const { pending } = useFormStatus();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const confirmed = window.confirm(
      `Deseja remover ${studentName} da sua lista de dependentes? A matrícula, a turma e a pontuação do aluno não serão alteradas.`
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
      className="flex h-8 w-8 items-center justify-center border-2 border-foreground bg-surface/95 shadow-editorial-sm transition-all hover:bg-es-orange hover:shadow-editorial-hover"
      title="Remover da minha lista"
      aria-label={`Remover ${studentName} da minha lista de dependentes`}
    >
      {pending ? <ButtonLoader size="sm" label={`Removendo ${studentName}`} /> : <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />}
    </button>
  );
}
