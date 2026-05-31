"use client";

import { useEffect, useState, useTransition } from "react";
import { updateOfferingAction } from "@/app/actions/attendance";
import { ArrowRight } from "lucide-react";
import { OfferingLoader } from "@/components/ui/AppLoader";
import { useRouter } from "next/navigation";

interface OfferingInputProps {
  classId: string;
  date: string;
  initialAmount: number;
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

export default function OfferingInput({ classId, date, initialAmount }: OfferingInputProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amountDisplay, setAmountDisplay] = useState(() => formatCurrency(initialAmount));
  const [savedAmount, setSavedAmount] = useState(initialAmount);

  useEffect(() => {
    setAmountDisplay(formatCurrency(initialAmount));
    setSavedAmount(initialAmount);
  }, [initialAmount]);

  const handleSave = () => {
    const amount = parseCurrency(amountDisplay);
    if (amount === savedAmount) return;

    startTransition(async () => {
      const result = await updateOfferingAction(classId, date, amount);
      if (!result?.error) {
        setSavedAmount(amount);
        router.refresh();
        window.setTimeout(() => {
          document.getElementById("offering-history")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 120);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <input 
        type="text"
        inputMode="numeric"
        value={amountDisplay}
        onChange={(event) => setAmountDisplay(normalizeCurrencyInput(event.target.value))}
        disabled={isPending}
        className={`w-full h-12 bg-surface border-4 border-foreground px-4 font-black text-xl text-right outline-none transition-all ${isPending ? "opacity-50" : "focus:shadow-editorial-sm"}`}
        placeholder="R$ 0,00"
      />

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="h-12 bg-es-lilac border-4 border-foreground text-foreground font-black text-sm uppercase tracking-widest flex items-center justify-between px-6 shadow-editorial-sm hover:shadow-editorial-hover active:translate-y-0.5 active:translate-x-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
      >
        <span>{isPending ? "SALVANDO..." : "SALVAR OFERTA"}</span>
        {isPending ? (
          <OfferingLoader />
        ) : (
          <ArrowRight className="w-5 h-5 stroke-[3]" />
        )}
      </button>
    </div>
  );
}
