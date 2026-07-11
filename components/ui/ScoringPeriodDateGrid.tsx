import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import {
  fieldLabelClass,
  surfaceSoftClass,
} from "@/components/ui/design-system";

export interface ScoringPeriodDateGridProps {
  periodId: string;
  periodName: string;
  schedule: readonly string[];
  canWrite: boolean;
  requiresChangeReason: boolean;
}

function formatSaturday(date: string) {
  return format(new Date(`${date}T12:00:00-03:00`), "dd 'de' MMMM 'de' yyyy", {
    locale: ptBR,
  });
}

export default function ScoringPeriodDateGrid({
  periodId,
  periodName,
  schedule,
  canWrite,
  requiresChangeReason,
}: ScoringPeriodDateGridProps) {
  const editingMessage = canWrite
    ? requiresChangeReason
      ? "Este período aceita correções. Ao salvar uma alteração, informe o motivo."
      : "Este período está aberto. O professor pode lançar e revisar os registros."
    : "Este período foi auditado e está disponível somente para consulta.";

  return (
    <section className={`${surfaceSoftClass} flex flex-col gap-5 p-4 md:p-6`}>
      <div className="flex flex-col gap-2">
        <p className={fieldLabelClass}>Registros por sábado</p>
        <h4 className="text-xl font-black uppercase tracking-tighter text-foreground">
          Datas de {periodName}
        </h4>
        <p className="text-sm font-bold leading-relaxed opacity-70">
          Selecione uma data para abrir a frequência e a pontuação daquele sábado.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {schedule.map((date, index) => {
          const dateLabel = formatSaturday(date);

          return (
            <Link
              key={date}
              href={{
                pathname: "/relatorios/lancamento",
                query: { period: periodId, d: date },
              }}
              aria-label={`Abrir os registros de ${dateLabel} em ${periodName}`}
              className="flex min-h-14 flex-col justify-center gap-1 border-4 border-foreground bg-surface px-4 py-3 shadow-editorial-sm transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:bg-background hover:shadow-none focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className={fieldLabelClass}>Sábado {index + 1}</span>
              <span className="text-sm font-black uppercase leading-tight text-foreground">
                {dateLabel}
              </span>
            </Link>
          );
        })}
      </div>

      <p className="border-4 border-foreground bg-background p-4 text-sm font-bold leading-relaxed">
        {editingMessage}
      </p>
    </section>
  );
}
