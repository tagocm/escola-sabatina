"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface WeeklyBibleVerseStickyCardProps {
  verse: {
    week_date: string;
    verse_text: string;
    bible_book: string;
    chapter_number: number;
    verse_reference: string;
  } | null;
}

export default function WeeklyBibleVerseStickyCard({
  verse,
}: WeeklyBibleVerseStickyCardProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!verse || !isVisible) {
    return null;
  }

  return (
    <section className="fixed inset-x-3 top-[max(env(safe-area-inset-top),0.75rem)] z-50 mx-auto w-auto max-w-md md:left-1/2 md:right-auto md:w-[min(30rem,calc(100vw-2rem))] md:-translate-x-1/2">
      <div className="relative overflow-hidden border-2 border-foreground bg-white shadow-editorial-sm supports-[backdrop-filter]:bg-white/92 supports-[backdrop-filter]:backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setIsVisible(false)}
          aria-label="Fechar verso da semana"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center border-2 border-foreground bg-background transition-colors hover:bg-es-yellow active:translate-x-0.5 active:translate-y-0.5"
        >
          <X className="h-3.5 w-3.5 stroke-[3]" />
        </button>

        <div className="px-4 py-3 pr-12 md:px-5 md:py-4 md:pr-12">
          <p className="max-h-28 overflow-y-auto pr-1 text-[13px] font-semibold leading-6 text-foreground md:max-h-32 md:text-sm md:leading-6">
            {verse.verse_text}
          </p>
        </div>
      </div>
    </section>
  );
}
