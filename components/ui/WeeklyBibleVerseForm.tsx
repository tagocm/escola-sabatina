"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, Loader2, X } from "lucide-react";
import { saveClassWeeklyBibleVerseAction } from "@/app/actions/classes";
import {
  alertClass,
  compactInputClass,
  fieldLabelClass,
  primaryActionBlockClass,
} from "@/components/ui/design-system";

interface WeeklyBibleVerseFormProps {
  classId: string;
  initialData?: {
    id: string;
    week_date: string;
    verse_text: string;
    bible_book: string;
    chapter_number: number;
    verse_reference: string;
  };
  onClose: () => void;
}

const sentenceInputClass =
  "w-full min-h-12 border-4 border-foreground bg-white px-4 text-base font-semibold text-foreground outline-none transition-all focus:shadow-editorial-sm md:text-sm normal-case tracking-normal";

const sentenceTextareaClass = `${sentenceInputClass} min-h-[144px] py-3 leading-6 resize-y`;

function getUpcomingSaturdayInput() {
  const today = new Date();
  const saturday = new Date(today);
  saturday.setHours(12, 0, 0, 0);
  saturday.setDate(today.getDate() + ((6 - today.getDay() + 7) % 7));

  return `${saturday.getFullYear()}-${String(saturday.getMonth() + 1).padStart(2, "0")}-${String(saturday.getDate()).padStart(2, "0")}`;
}

export default function WeeklyBibleVerseForm({
  classId,
  initialData,
  onClose,
}: WeeklyBibleVerseFormProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);
    const formData = new FormData(event.currentTarget);

    if (initialData?.id) {
      formData.set("id", initialData.id);
    }

    startTransition(async () => {
      const result = await saveClassWeeklyBibleVerseAction(classId, formData);
      if (result?.error) {
        setErrorMsg(result.error);
        return;
      }

      onClose();
    });
  };

  return (
    <div className="flex flex-col gap-6 animate-in slide-in-from-top-4 duration-200">
      <div className="flex items-center justify-between border-b-4 border-foreground pb-2">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-black uppercase tracking-tighter">
            {initialData ? "Editar Verso" : "Novo Verso da Semana"}
          </h3>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/40">
            Este verso ficará disponível no topo do controle de frequência
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 transition-colors hover:bg-foreground hover:text-white"
          aria-label="Fechar formulário"
        >
          <X className="h-6 w-6 stroke-[3]" />
        </button>
      </div>

      {errorMsg && (
        <div className={alertClass}>
          <AlertTriangle className="h-5 w-5 stroke-[4]" />
          <p className="text-[11px] font-black uppercase tracking-widest">{errorMsg}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className={fieldLabelClass} htmlFor="week_date">
            Semana / Sábado de Referência
          </label>
          <input
            id="week_date"
            name="week_date"
            type="date"
            required
            disabled={isPending}
            defaultValue={initialData?.week_date || getUpcomingSaturdayInput()}
            className={`${compactInputClass} disabled:opacity-50`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className={fieldLabelClass} htmlFor="verse_text">
            Texto do Verso
          </label>
          <textarea
            id="verse_text"
            name="verse_text"
            required
            disabled={isPending}
            defaultValue={initialData?.verse_text || ""}
            placeholder="Ex.: Porque Deus amou o mundo de tal maneira..."
            className={`${sentenceTextareaClass} disabled:opacity-50`}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_120px_140px]">
          <div className="flex flex-col gap-2">
            <label className={fieldLabelClass} htmlFor="bible_book">
              Livro da Bíblia
            </label>
            <input
              id="bible_book"
              name="bible_book"
              type="text"
              required
              disabled={isPending}
              defaultValue={initialData?.bible_book || ""}
              placeholder="Ex.: João"
              className={`${sentenceInputClass} disabled:opacity-50`}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className={fieldLabelClass} htmlFor="chapter_number">
              Capítulo
            </label>
            <input
              id="chapter_number"
              name="chapter_number"
              type="number"
              min={1}
              required
              disabled={isPending}
              defaultValue={initialData?.chapter_number || 1}
              className={`${compactInputClass} font-black disabled:opacity-50`}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className={fieldLabelClass} htmlFor="verse_reference">
              Versículo
            </label>
            <input
              id="verse_reference"
              name="verse_reference"
              type="text"
              required
              disabled={isPending}
              defaultValue={initialData?.verse_reference || ""}
              placeholder="Ex.: 16"
              className={`${sentenceInputClass} disabled:opacity-50`}
            />
          </div>
        </div>

        <button type="submit" disabled={isPending} className={primaryActionBlockClass}>
          <span>{isPending ? "SALVANDO..." : "SALVAR VERSO DA SEMANA"}</span>
          {isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowRight className="h-6 w-6 stroke-[3] transition-transform group-hover:translate-x-1" />
          )}
        </button>
      </form>
    </div>
  );
}
