"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export interface AttendanceWeeklyBibleVerse {
  week_date: string;
  verse_text: string;
  bible_book: string;
  chapter_number: number;
  verse_reference: string;
}

interface AttendanceVerseConfirmationModalProps {
  studentName: string;
  verse: AttendanceWeeklyBibleVerse;
  points: number;
  onKnow: () => void;
  onDontKnow: () => void;
}

export default function AttendanceVerseConfirmationModal({
  studentName,
  verse,
  points,
  onKnow,
  onDontKnow,
}: AttendanceVerseConfirmationModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDontKnow();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDontKnow]);

  const modal = (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-foreground/45 p-3 backdrop-blur-[3px] sm:items-center sm:p-5">
      <button
        type="button"
        aria-label="Fechar confirmação do verso"
        className="absolute inset-0"
        onClick={onDontKnow}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="verse-confirmation-title"
        className="relative z-10 flex w-full max-w-xl flex-col overflow-hidden border-4 border-foreground bg-surface shadow-editorial"
      >
        <div className="flex items-start justify-between gap-4 border-b-4 border-foreground bg-surface-warm px-4 py-4 md:px-5">
          <div className="min-w-0">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
              Pontos do verso
            </span>
            <h3 id="verse-confirmation-title" className="mt-1 text-xl font-black uppercase leading-tight tracking-tight">
              {studentName} sabe o verso?
            </h3>
          </div>
          <button
            type="button"
            onClick={onDontKnow}
            className="flex h-10 w-10 shrink-0 items-center justify-center border-4 border-foreground bg-surface shadow-editorial-sm"
            aria-label="Fechar"
          >
            <X className="h-4 w-4 stroke-[3]" />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-4 md:p-5">
          <blockquote className="border-4 border-foreground bg-background p-4 text-sm font-semibold leading-relaxed">
            {verse.verse_text}{" "}
            <strong className="font-black">
              {verse.bible_book} {verse.chapter_number}:{verse.verse_reference}
            </strong>
          </blockquote>

          <p className="text-center text-[10px] font-black uppercase tracking-[0.16em] opacity-50">
            A resposta define se {points} {points === 1 ? "ponto será adicionado" : "pontos serão adicionados"}.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onKnow}
              className="min-h-14 border-4 border-foreground bg-es-green px-5 text-sm font-black uppercase tracking-[0.16em] shadow-editorial-sm transition-all hover:shadow-editorial active:translate-x-0.5 active:translate-y-0.5"
            >
              Sabe
            </button>
            <button
              type="button"
              onClick={onDontKnow}
              className="min-h-14 border-4 border-foreground bg-danger px-5 text-sm font-black uppercase tracking-[0.16em] text-surface shadow-editorial-sm transition-all hover:shadow-editorial active:translate-x-0.5 active:translate-y-0.5"
            >
              Não sabe
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;

  return createPortal(modal, document.body);
}
