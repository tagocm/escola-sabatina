"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteClassWeeklyBibleVerseAction } from "@/app/actions/classes";
import { alertClass } from "@/components/ui/design-system";
import WeeklyBibleVerseForm from "@/components/ui/WeeklyBibleVerseForm";

interface WeeklyBibleVerse {
  id: string;
  week_date: string;
  verse_text: string;
  bible_book: string;
  chapter_number: number;
  verse_reference: string;
}

interface WeeklyBibleVerseSectionProps {
  classId: string;
  verses: WeeklyBibleVerse[];
}

function formatWeekLabel(weekDate: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${weekDate}T12:00:00`));
}

function getCurrentSaturdayInput() {
  const today = new Date();
  const saturday = new Date(today);
  saturday.setHours(12, 0, 0, 0);
  saturday.setDate(today.getDate() + ((6 - today.getDay() + 7) % 7));

  return `${saturday.getFullYear()}-${String(saturday.getMonth() + 1).padStart(2, "0")}-${String(saturday.getDate()).padStart(2, "0")}`;
}

export default function WeeklyBibleVerseSection({
  classId,
  verses,
}: WeeklyBibleVerseSectionProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isAdding, setIsAdding] = useState(false);
  const [editingVerse, setEditingVerse] = useState<WeeklyBibleVerse | null>(null);
  const currentSaturday = getCurrentSaturdayInput();

  const handleDelete = (verse: WeeklyBibleVerse) => {
    const confirmed = window.confirm(
      `Remover o verso ${verse.bible_book} ${verse.chapter_number}:${verse.verse_reference}?`,
    );

    if (!confirmed) return;

    setErrorMsg(null);
    startTransition(async () => {
      const result = await deleteClassWeeklyBibleVerseAction(classId, verse.id);
      if (result?.error) {
        setErrorMsg(result.error);
      }
    });
  };

  const handleCreateClick = () => {
    setErrorMsg(null);
    setEditingVerse(null);
    setIsAdding(true);
  };

  const handleEditClick = (verse: WeeklyBibleVerse) => {
    setErrorMsg(null);
    setIsAdding(false);
    setEditingVerse(verse);
  };

  const handleCloseForm = () => {
    setIsAdding(false);
    setEditingVerse(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {errorMsg && (
        <div className={alertClass}>
          <AlertTriangle className="h-6 w-6 stroke-[3]" />
          <p className="text-[11px] font-black uppercase tracking-widest">{errorMsg}</p>
        </div>
      )}

      <div className="flex flex-col gap-4 border-b-8 border-foreground pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-[30px] font-black uppercase tracking-tighter leading-none">
            Verso Bíblico da Semana
          </h2>
          <p className="max-w-2xl text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/45">
            Cadastre os versos que ficarão fixos no topo do controle de frequência de cada semana.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreateClick}
          className="flex min-h-12 items-center justify-center gap-2 border-4 border-foreground bg-es-yellow px-5 text-[11px] font-black uppercase tracking-[0.16em] shadow-editorial-sm transition-all hover:shadow-editorial active:translate-x-0.5 active:translate-y-0.5"
        >
          <Plus className="h-5 w-5 stroke-[3]" />
          Novo Verso
        </button>
      </div>

      {(isAdding || editingVerse) && (
        <div className="border-4 border-foreground bg-surface-warm p-5 shadow-editorial md:p-6">
          <WeeklyBibleVerseForm
            classId={classId}
            initialData={editingVerse || undefined}
            onClose={handleCloseForm}
          />
        </div>
      )}

      {verses.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {verses.map((verse) => {
            const referenceLabel = `${verse.bible_book} ${verse.chapter_number}:${verse.verse_reference}`;
            const isCurrentWeek = verse.week_date === currentSaturday;

            return (
              <article
                key={verse.id}
                className="overflow-hidden border-4 border-foreground bg-surface shadow-editorial-sm"
              >
                <div className="h-2 w-full border-b-4 border-foreground bg-es-blue" />
                <div className="flex flex-col gap-4 p-4 md:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 border-2 border-foreground bg-background px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
                        <CalendarDays className="h-3.5 w-3.5 stroke-[3]" />
                        {formatWeekLabel(verse.week_date)}
                      </span>
                      {isCurrentWeek && (
                        <span className="border-2 border-foreground bg-es-yellow px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
                          Atual
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditClick(verse)}
                        className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-surface transition-colors hover:bg-es-yellow"
                        aria-label={`Editar verso ${referenceLabel}`}
                      >
                        <Pencil className="h-4 w-4 stroke-[3]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(verse)}
                        disabled={isPending}
                        className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-es-orange transition-colors hover:bg-es-orange/80 disabled:opacity-50"
                        aria-label={`Excluir verso ${referenceLabel}`}
                      >
                        <Trash2 className="h-4 w-4 stroke-[3]" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/45">
                      {referenceLabel}
                    </p>
                    <p className="whitespace-pre-line text-sm font-semibold leading-6 text-foreground md:text-[15px]">
                      {verse.verse_text}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="border-4 border-dashed border-foreground/30 bg-background px-6 py-10 text-center">
          <p className="text-lg font-black uppercase tracking-tight opacity-40">
            Nenhum verso cadastrado ainda
          </p>
        </div>
      )}
    </div>
  );
}
