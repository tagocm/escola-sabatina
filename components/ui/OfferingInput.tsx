"use client";

import { useEffect, useId, useState, useTransition, type FormEvent } from "react";
import { updateOfferingAction } from "@/app/actions/attendance";
import { AlertTriangle, ArrowRight, Lock } from "lucide-react";
import { OfferingLoader } from "@/components/ui/AppLoader";
import { useRouter } from "next/navigation";
import {
  alertClass,
  compactInputClass,
  fieldLabelClass,
  primaryActionCenteredClass,
  primaryActionClass,
  readonlyInputClass,
  secondaryActionClass,
  textInputClass,
} from "@/components/ui/design-system";

interface OfferingInputProps {
  classId: string;
  periodId: string;
  date: string;
  initialAmount: number;
  readOnly: boolean;
  requiresChangeReason: boolean;
  autoFocus?: boolean;
  onCancel?: () => void;
  onPendingChange?: (pending: boolean) => void;
  onSaved?: () => void;
  scrollToHistoryOnSave?: boolean;
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
  autoFocus = false,
  onCancel,
  onPendingChange,
  onSaved,
  scrollToHistoryOnSave = true,
}: OfferingInputProps) {
  const router = useRouter();
  const fieldId = useId();
  const [isPending, startTransition] = useTransition();
  const [amountDisplay, setAmountDisplay] = useState(() => formatCurrency(initialAmount));
  const [savedAmount, setSavedAmount] = useState(initialAmount);
  const [changeReason, setChangeReason] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const amount = parseCurrency(amountDisplay);
  const hasChanges = amount !== savedAmount;
  const amountInputId = `offering-amount-${fieldId}`;
  const changeReasonInputId = `offering-change-reason-${fieldId}`;

  useEffect(() => {
    onPendingChange?.(isPending);

    return () => {
      if (isPending) onPendingChange?.(false);
    };
  }, [isPending, onPendingChange]);

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
      onSaved?.();
      router.refresh();
      if (scrollToHistoryOnSave) {
        document.getElementById("offering-history")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
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
        <label htmlFor={amountInputId} className={fieldLabelClass}>
          Valor arrecadado
        </label>
        <input
          id={amountInputId}
          type="text"
          inputMode="numeric"
          value={amountDisplay}
          onChange={(event) => setAmountDisplay(normalizeCurrencyInput(event.target.value))}
          onFocus={(event) => {
            if (autoFocus) event.currentTarget.select();
          }}
          disabled={isPending || readOnly}
          className={`${readOnly ? readonlyInputClass : textInputClass} text-right text-xl`}
          placeholder="R$ 0,00"
          autoFocus={autoFocus && !readOnly}
        />
      </div>

      {requiresChangeReason && !readOnly && (
        <div className="flex flex-col gap-2">
          <label htmlFor={changeReasonInputId} className={fieldLabelClass}>
            Motivo da correção
          </label>
          <input
            id={changeReasonInputId}
            type="text"
            value={changeReason}
            onChange={(event) => setChangeReason(event.target.value)}
            disabled={isPending}
            required
            minLength={10}
            className={compactInputClass}
            placeholder="Explique por que o valor será alterado"
            aria-describedby={`${changeReasonInputId}-help`}
          />
          <p
            id={`${changeReasonInputId}-help`}
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

      {onCancel ? (
        <div className="grid grid-cols-2 gap-3 border-t-4 border-foreground/10 pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className={secondaryActionClass}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending || readOnly || !hasChanges}
            className={primaryActionCenteredClass}
          >
            {isPending ? <OfferingLoader /> : null}
            {isPending ? "Salvando" : "Salvar"}
          </button>
        </div>
      ) : (
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
      )}
    </form>
  );
}
