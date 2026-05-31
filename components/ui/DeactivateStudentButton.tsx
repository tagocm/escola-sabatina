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
      `Deseja ocultar o cadastro de ${studentName}? O aluno ficará inativo para o responsável e poderá ser reativado pelo professor.`
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
      title="Ocultar dependente"
      aria-label={`Ocultar ${studentName}`}
    >
      {pending ? <ButtonLoader size="sm" label={`Ocultando ${studentName}`} /> : <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />}
    </button>
  );
}
