import Link from "next/link";
import { BookOpen, Settings } from "lucide-react";

interface WeeklyBibleVerseStickyCardProps {
  classId: string;
  displayDate: string;
  verseWeekDisplayDate: string;
  verse: {
    week_date: string;
    verse_text: string;
    bible_book: string;
    chapter_number: number;
    verse_reference: string;
  } | null;
}

function formatWeekLabel(weekDate: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
  }).format(new Date(`${weekDate}T12:00:00`));
}

export default function WeeklyBibleVerseStickyCard({
  classId,
  displayDate,
  verseWeekDisplayDate,
  verse,
}: WeeklyBibleVerseStickyCardProps) {
  const classSettingsHref = `/classes/${classId}#weekly-bible-verse-section`;
  const referenceLabel = verse
    ? `${verse.bible_book} ${verse.chapter_number}:${verse.verse_reference}`
    : null;

  return (
    <section className="sticky top-3 z-30">
      <div className="overflow-hidden border-4 border-foreground bg-white shadow-editorial">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="flex min-w-0 flex-col gap-3 p-4 md:p-5">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-es-yellow shadow-editorial-sm">
                <BookOpen className="h-5 w-5 stroke-[3]" />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/45">
                  Verso Bíblico da Semana
                </span>
                <span className="text-sm font-black uppercase tracking-tight text-foreground md:text-base">
                  {referenceLabel || "Verso não cadastrado"}
                </span>
              </div>
            </div>

            {verse ? (
              <div className="flex flex-col gap-2">
                <p className="max-h-[24svh] overflow-y-auto pr-1 text-sm font-semibold leading-6 text-foreground md:max-h-none md:text-[15px]">
                  {verse.verse_text}
                </p>
              </div>
            ) : (
              <p className="text-sm font-semibold leading-6 text-foreground/70">
                Cadastre o verso desta semana nas configurações da classe para mantê-lo sempre visível durante o lançamento da frequência.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4 border-t-4 border-foreground bg-background p-4 lg:border-l-4 lg:border-t-0">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/45">
                Sábado da Frequência
              </span>
              <span className="text-xl font-black uppercase leading-none tracking-tighter">
                {displayDate}
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/45">
                Verso esperado da semana
              </span>
              <span className="text-base font-black uppercase leading-none tracking-tighter">
                {verseWeekDisplayDate}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/45">
                {verse ? `Registrado para ${formatWeekLabel(verse.week_date)}` : "Sem referência cadastrada"}
              </span>
            </div>

            <Link
              href={classSettingsHref}
              className="flex min-h-12 items-center justify-between gap-3 border-4 border-foreground bg-white px-4 text-[11px] font-black uppercase tracking-[0.16em] shadow-editorial-sm transition-all hover:shadow-editorial-hover active:translate-x-0.5 active:translate-y-0.5"
            >
              <span>{verse ? "Editar Verso" : "Cadastrar Agora"}</span>
              <Settings className="h-4 w-4 stroke-[3]" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
