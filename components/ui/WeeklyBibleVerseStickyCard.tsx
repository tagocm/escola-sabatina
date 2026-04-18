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
    <section className="sticky top-3 z-40">
      <div className="relative overflow-hidden border-4 border-foreground bg-white shadow-editorial-sm supports-[backdrop-filter]:bg-white/95 supports-[backdrop-filter]:backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setIsVisible(false)}
          aria-label="Fechar verso da semana"
          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center border-2 border-foreground bg-background transition-colors hover:bg-es-yellow active:translate-x-0.5 active:translate-y-0.5"
        >
          <X className="h-4 w-4 stroke-[3]" />
        </button>

        <div className="pr-14 pl-4 py-4 md:px-5 md:py-4">
          <p className="text-sm font-semibold leading-7 text-foreground md:text-[15px]">
            {verse.verse_text}
          </p>
        </div>
      </div>
    </section>
  );
}
