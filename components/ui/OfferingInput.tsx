"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateOfferingAction } from "@/app/actions/attendance";
import { AlertTriangle, ArrowRight, Lock } from "lucide-react";
import { OfferingLoader } from "@/components/ui/AppLoader";
import { useRouter } from "next/navigation";
import {
  alertClass,
  compactInputClass,
  fieldLabelClass,
  primaryActionClass,
  readonlyInputClass,
  textInputClass,
} from "@/components/ui/design-system";

interface OfferingInputProps {
  classId: string;
  periodId: string;
  date: string;
  initialAmount: number;
  readOnly: boolean;
  requiresChangeReason: boolean;
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0);
}

function parseCurrency(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  const amount = Number(digits || "0") / 100;
  return formatCurrency(amount);
}

export default function OfferingInput({
  classId,
  periodId,
  date,
  initialAmount,
  readOnly,
  requiresChangeReason,
}: OfferingInputProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amountDisplay, setAmountDisplay] = useState(() => formatCurrency(initialAmount));
  const [savedAmount, setSavedAmount] = useState(initialAmount);
  const [changeReason, setChangeReason] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const amount = parseCurrency(amountDisplay);
  const hasChanges = amount !== savedAmount;

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError(null);

    if (readOnly || !hasChanges) return;

    const normalizedReason = changeReason.trim();
    if (requiresChangeReason && normalizedReason.length < 10) {
      setSaveError("Informe um motivo com pelo menos 10 caracteres para corrigir este período.");
      return;
    }

    startTransition(async () => {
      const result = await updateOfferingAction(
        classId,
        date,
        amount,
        normalizedReason,
        periodId,
      );

      if (result?.error) {
        setSaveError(result.error);
        return;
      }

      setSavedAmount(amount);
      setChangeReason("");
      router.refresh();
      document.getElementById("offering-history")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      {saveError && (
        <div className={alertClass} role="alert">
          <AlertTriangle className="h-5 w-5 shrink-0 stroke-[3]" />
          <p className="text-[10px] font-black uppercase tracking-widest">{saveError}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="offering-amount" className={fieldLabelClass}>
          Valor arrecadado
        </label>
        <input
          id="offering-amount"
          type="text"
          inputMode="numeric"
          value={amountDisplay}
          onChange={(event) => setAmountDisplay(normalizeCurrencyInput(event.target.value))}
          disabled={isPending || readOnly}
          className={`${readOnly ? readonlyInputClass : textInputClass} text-right text-xl`}
          placeholder="R$ 0,00"
        />
      </div>

      {requiresChangeReason && !readOnly && (
        <div className="flex flex-col gap-2">
          <label htmlFor="offering-change-reason" className={fieldLabelClass}>
            Motivo da correção
          </label>
          <input
            id="offering-change-reason"
            type="text"
            value={changeReason}
            onChange={(event) => setChangeReason(event.target.value)}
            disabled={isPending}
            required
            minLength={10}
            className={compactInputClass}
            placeholder="Explique por que o valor será alterado"
            aria-describedby="offering-change-reason-help"
          />
          <p
            id="offering-change-reason-help"
            className="text-[9px] font-bold uppercase tracking-widest opacity-60"
          >
            Obrigatório para alterações em períodos encerrados ou em auditoria.
          </p>
        </div>
      )}

      {readOnly && (
        <div className="flex items-center gap-3 border-4 border-foreground bg-background p-4">
          <Lock className="h-5 w-5 shrink-0 stroke-[3]" />
          <p className="text-[10px] font-black uppercase tracking-widest">
            Período auditado: oferta disponível somente para consulta.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || readOnly || !hasChanges}
        className={`w-full ${primaryActionClass}`}
      >
        <span>
          {isPending
            ? "SALVANDO..."
            : readOnly
              ? "SOMENTE LEITURA"
              : hasChanges
                ? "SALVAR OFERTA"
                : "SEM ALTERAÇÕES"}
        </span>
        {isPending ? (
          <OfferingLoader />
        ) : readOnly ? (
          <Lock className="h-5 w-5 stroke-[3]" />
        ) : (
          <ArrowRight className="h-5 w-5 stroke-[3]" />
        )}
      </button>
    </form>
  );
}
