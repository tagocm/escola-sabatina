"use client";

import { useTransition, useState } from "react";
import { ArrowRight, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { ButtonLoader } from "@/components/ui/AppLoader";
import {
  alertClass,
  compactInputClass,
  fieldLabelClass,
  primaryActionWideClass,
  secondaryActionWideClass,
  textInputClass,
} from "@/components/ui/design-system";

interface ClassFormProps {
  initialData?: {
    id: string;
    name: string;
    offering_goal?: number;
    is_active: boolean;
  };
  action: (formData: FormData) => Promise<{ error?: string } | void>;
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatOfferingGoal(value: number) {
  return currencyFormatter.format(value || 0);
}

function normalizeCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  const amount = Number(digits || "0") / 100;
  return formatOfferingGoal(amount);
}

export default function ClassForm({ initialData, action }: ClassFormProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [offeringGoalDisplay, setOfferingGoalDisplay] = useState(() =>
    formatOfferingGoal(initialData?.offering_goal ?? 0),
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const formData = new FormData(e.currentTarget);
    
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

      <div className="flex flex-col gap-2">
        <label className={fieldLabelClass} htmlFor="name">
          Nome da Classe
        </label>
        <input
          disabled={isPending}
          id="name"
          name="name"
          type="text"
          defaultValue={initialData?.name || ""}
          placeholder="EX: ADULTOS B"
          required
          className={`${textInputClass} placeholder:text-foreground/30 disabled:opacity-50`}
        />
      </div>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-col gap-2 xl:w-[220px] xl:shrink-0">
          <label className={`${fieldLabelClass} whitespace-nowrap`} htmlFor="offering_goal">
            Meta de Ofertas por Sábado
          </label>
          <input
            disabled={isPending}
            id="offering_goal"
            name="offering_goal"
            type="text"
            inputMode="numeric"
            value={offeringGoalDisplay}
            onChange={(event) => setOfferingGoalDisplay(normalizeCurrencyInput(event.target.value))}
            className={`${compactInputClass} text-right disabled:opacity-50`}
          />
          <p className="text-[9px] font-bold uppercase leading-relaxed tracking-[0.12em] opacity-50">
            A mudança vale para novos períodos; a meta do trimestre atual permanece congelada.
          </p>
        </div>

        <div className="flex flex-col gap-2 xl:pb-1">
          <label className={fieldLabelClass}>
            Situação
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="radio" 
                name="is_active" 
                value="true" 
                defaultChecked={initialData ? initialData.is_active : true}
                className="w-5 h-5 border-[3px] border-foreground appearance-none checked:bg-foreground transition-colors"
              />
              <span className="font-bold uppercase tracking-widest text-sm group-hover:bg-es-yellow px-1 transition-colors">Ativa</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="radio" 
                name="is_active" 
                value="false" 
                defaultChecked={initialData ? !initialData.is_active : false}
                className="w-5 h-5 border-[3px] border-foreground appearance-none checked:bg-foreground transition-colors"
              />
              <span className="font-bold uppercase tracking-widest text-sm group-hover:bg-es-yellow px-1 transition-colors">Inativa</span>
            </label>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
        <Link 
          href="/classes"
          className={secondaryActionWideClass}
        >
          CANCELAR
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className={primaryActionWideClass}
        >
          <span>{isPending ? "SALVANDO..." : "SALVAR CLASSE"}</span>
          {isPending ? (
            <ButtonLoader />
          ) : (
            <ArrowRight className="w-6 h-6 group-active:translate-x-2 transition-transform stroke-[3]" />
          )}
        </button>
      </div>
    </form>
  );
}
