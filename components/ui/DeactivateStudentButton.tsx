"use client";

import { Trash2 } from "lucide-react";

interface DeactivateStudentButtonProps {
  studentName: string;
}

export default function DeactivateStudentButton({
  studentName,
}: DeactivateStudentButtonProps) {
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
      className="flex h-8 w-8 items-center justify-center border-2 border-foreground bg-surface/95 shadow-editorial-sm transition-all hover:bg-es-orange hover:shadow-editorial-hover"
      title="Ocultar dependente"
      aria-label={`Ocultar ${studentName}`}
    >
      <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
    </button>
  );
}
