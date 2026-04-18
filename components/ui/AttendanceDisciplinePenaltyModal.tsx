"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import {
  alertClass,
  fieldLabelClass,
  primaryActionCenteredClass,
  secondaryActionClass,
} from "@/components/ui/design-system";

interface AttendanceDisciplinePenaltyModalProps {
  studentName: string;
  currentPenaltyPoints: number;
  initialReason?: string;
  initialAppliedByName?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export default function AttendanceDisciplinePenaltyModal({
  studentName,
  currentPenaltyPoints,
  initialReason = "",
  initialAppliedByName = "",
  onClose,
  onConfirm,
}: AttendanceDisciplinePenaltyModalProps) {
  const [reason, setReason] = useState(initialReason);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = () => {
    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      setErrorMsg("Informe o motivo do desconto por indisciplina.");
      return;
    }

    onConfirm(trimmedReason);
  };

  const modal = (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-foreground/35 p-3 backdrop-blur-[2px] md:items-center md:p-4">
      <button
        type="button"
        aria-label="Fechar janela de indisciplina"
        className="absolute inset-0"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Registrar desconto por indisciplina para ${studentName}`}
        className="relative z-10 flex max-h-[90svh] w-full max-w-xl flex-col overflow-hidden border-4 border-foreground bg-[#FFFCEE] shadow-editorial"
      >
        <div className="flex items-start justify-between gap-4 border-b-4 border-foreground px-4 py-4 md:px-5 md:py-4">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
              Evento de desconto
            </span>
            <h3 className="text-lg font-black uppercase tracking-tight md:text-xl">
              Indisciplina
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center border-4 border-foreground bg-white shadow-editorial-sm"
            aria-label="Fechar"
          >
            <X className="h-4 w-4 stroke-[3]" />
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto p-4 md:p-5">
          {errorMsg ? (
            <div className={alertClass}>
              <AlertTriangle className="h-5 w-5 stroke-[3]" />
              <p className="text-[10px] font-black uppercase tracking-[0.18em]">{errorMsg}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="border-2 border-foreground bg-white px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">Aluno</p>
              <p className="mt-1 text-sm font-black uppercase tracking-tight">{studentName}</p>
            </div>
            <div className="border-2 border-foreground bg-white px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">Novo desconto</p>
              <p className="mt-1 text-sm font-black uppercase tracking-tight">-{currentPenaltyPoints + 1} ponto(s)</p>
            </div>
          </div>

          <label className="flex flex-col gap-2">
            <span className={fieldLabelClass}>Motivo do desconto</span>
            <textarea
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                if (errorMsg) {
                  setErrorMsg(null);
                }
              }}
              placeholder="Descreva o ocorrido"
              rows={5}
              className="min-h-[132px] w-full resize-none border-4 border-foreground bg-white px-3 py-3 text-sm font-bold leading-relaxed outline-none transition-colors focus:bg-es-orange/10"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="border-2 border-foreground bg-background px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">Último motivo registrado</p>
              <p className="mt-1 text-[10px] font-bold uppercase leading-relaxed tracking-[0.08em]">
                {initialReason || "Nenhum registro anterior"}
              </p>
            </div>
            <div className="border-2 border-foreground bg-background px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">Último professor registrado</p>
              <p className="mt-1 text-[10px] font-bold uppercase leading-relaxed tracking-[0.08em]">
                {initialAppliedByName || "Será registrado ao salvar"}
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t-4 border-foreground/10 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className={secondaryActionClass}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className={primaryActionCenteredClass}
            >
              Confirmar desconto
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(modal, document.body);
}
