"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRightLeft } from "lucide-react";
import { ButtonLoader } from "@/components/ui/AppLoader";
import {
  alertClass,
  compactInputClass,
  fieldLabelClass,
  primaryActionWideClass,
  secondaryActionWideClass,
} from "@/components/ui/design-system";

interface ClassOption {
  id: string;
  name: string;
  is_active?: boolean;
}

interface ClassTransferFormProps {
  currentClassName: string;
  studentCount: number;
  destinationClasses: ClassOption[];
  action: (formData: FormData) => Promise<{ error?: string } | void>;
}

export default function ClassTransferForm({
  currentClassName,
  studentCount,
  destinationClasses,
  action,
}: ClassTransferFormProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasDestination = destinationClasses.length > 0;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);

    if (!hasDestination) {
      setErrorMsg("Crie ou ative uma classe de destino antes de transferir os alunos.");
      return;
    }

    const confirmed = window.confirm(
      `Transferir ${studentCount} aluno(s) de ${currentClassName} para a classe selecionada? Use esta ação somente para uma mudança real de classe. Ela não fecha nem abre um trimestre.`,
    );

    if (!confirmed) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) {
        setErrorMsg(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {errorMsg && (
        <div className={alertClass}>
          <AlertTriangle className="w-6 h-6 stroke-[3]" />
          <p className="text-[11px] font-black uppercase tracking-widest">{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_240px] md:items-end">
        <div className="flex flex-col gap-2">
          <label className={fieldLabelClass}>Classe de Destino</label>
          <select
            name="targetClassId"
            disabled={isPending || !hasDestination}
            className={`${compactInputClass} appearance-none`}
            defaultValue=""
          >
            <option value="" disabled>
              {hasDestination ? "Selecione uma classe..." : "Nenhuma classe disponível"}
            </option>
            {destinationClasses.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        <div className="border-4 border-foreground bg-es-yellow px-4 py-3 shadow-editorial-sm">
          <p className="text-[9px] font-black uppercase tracking-widest opacity-50">
            Alunos ativos que mudarão de classe
          </p>
          <p className="mt-1 text-3xl font-black leading-none">{studentCount}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className={fieldLabelClass}>Motivo da mudança</label>
        <textarea
          name="reason"
          required
          minLength={10}
          disabled={isPending || !hasDestination}
          rows={3}
          className="min-h-24 resize-y border-4 border-foreground bg-background px-4 py-3 text-sm font-bold outline-none focus:bg-es-lilac/10 disabled:opacity-50"
          placeholder="Explique por que os alunos mudarão de classe"
        />
      </div>

      <div className="flex flex-col gap-2 border-4 border-foreground bg-background px-4 py-4 shadow-editorial-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.18em]">
          Use este fluxo somente quando os alunos realmente mudarem de classe.
        </p>
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">
          Esta ação não encerra o trimestre, não inicia uma nova contagem de pontos e não altera o período de pontuação. Ela apenas troca a classe atual dos alunos ativos.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Link href="/classes" className={secondaryActionWideClass}>
          VOLTAR
        </Link>
        <button
          type="submit"
          disabled={isPending || !hasDestination}
          className={primaryActionWideClass}
        >
          <span>{isPending ? "TRANSFERINDO..." : "TRANSFERIR ALUNOS"}</span>
          {isPending ? (
            <ButtonLoader label="Transferindo alunos" />
          ) : (
            <ArrowRightLeft className="w-5 h-5 stroke-[3]" />
          )}
        </button>
      </div>
    </form>
  );
}
