import Link from "next/link";
import {
  compactInputClass,
  fieldLabelClass,
  surfaceSoftClass,
} from "@/components/ui/design-system";

export interface ScoringPeriodSelectorOption {
  id: string;
  label: string;
  statusLabel: string;
}

export interface ScoringPeriodSelectorProps<
  TPeriod extends ScoringPeriodSelectorOption,
> {
  periods: readonly TPeriod[];
  selectedPeriodId?: string | null;
  pathname: string;
  query?: Record<string, string | string[] | undefined>;
  label?: string;
  emptyMessage?: string;
}

function getDefinedQuery(
  query: Record<string, string | string[] | undefined> | undefined,
) {
  return Object.fromEntries(
    Object.entries(query ?? {}).filter((entry): entry is [string, string | string[]] => {
      return entry[1] !== undefined;
    }),
  );
}

export default function ScoringPeriodSelector<
  TPeriod extends ScoringPeriodSelectorOption,
>({
  periods,
  selectedPeriodId,
  pathname,
  query,
  label = "Período de pontuação",
  emptyMessage = "Nenhum período disponível.",
}: ScoringPeriodSelectorProps<TPeriod>) {
  const preservedQuery = getDefinedQuery(query);

  return (
    <section className={`${surfaceSoftClass} flex flex-col gap-4 p-4 md:p-5`}>
      <div className="flex flex-col gap-2">
        <p className={fieldLabelClass}>{label}</p>
        <p className="text-xs font-bold uppercase leading-relaxed opacity-60">
          Escolha o trimestre que deseja consultar.
        </p>
      </div>

      {periods.length === 0 ? (
        <p className="border-4 border-dashed border-foreground bg-background p-4 text-sm font-black uppercase">
          {emptyMessage}
        </p>
      ) : (
        <nav aria-label={label}>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {periods.map((period) => {
              const isSelected = period.id === selectedPeriodId;

              return (
                <li key={period.id}>
                  <Link
                    href={{
                      pathname,
                      query: { ...preservedQuery, period: period.id },
                    }}
                    aria-current={isSelected ? "page" : undefined}
                    className={`${compactInputClass} flex items-center justify-between gap-3 no-underline ${
                      isSelected ? "bg-es-lilac" : "hover:bg-background"
                    }`}
                  >
                    <span className="min-w-0 truncate">{period.label}</span>
                    <span className="min-w-0 text-right text-[8px] font-black leading-tight tracking-[0.12em] opacity-60">
                      {period.statusLabel}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </section>
  );
}
