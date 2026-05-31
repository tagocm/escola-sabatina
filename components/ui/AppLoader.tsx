import { CalendarDays, Camera, Coins, Trophy } from "lucide-react";

type LoaderSize = "sm" | "md";

const dotSizeClass: Record<LoaderSize, string> = {
  sm: "h-2 w-2",
  md: "h-3 w-3",
};

export function ButtonLoader({ size = "md", label = "Carregando" }: { size?: LoaderSize; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" role="status" aria-label={label}>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={`${dotSizeClass[size]} border-2 border-foreground bg-current motion-safe:animate-loader-hop`}
          style={{ animationDelay: `${index * 110}ms` }}
        />
      ))}
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function SabbathProgressLoader({ label = "Carregando trimestre" }: { label?: string }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label={label}>
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center border-4 border-foreground bg-es-blue shadow-editorial-sm">
          <CalendarDays className="h-4 w-4 stroke-[3]" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.18em] opacity-50">
          13 sábados
        </span>
      </div>
      <div className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-1">
        {Array.from({ length: 13 }, (_, index) => (
          <span
            key={index}
            className="h-8 border-2 border-foreground bg-surface motion-safe:animate-loader-step"
            style={{ animationDelay: `${index * 80}ms` }}
          />
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function OfferingLoader({ label = "Salvando oferta" }: { label?: string }) {
  return (
    <div className="flex items-end gap-1" role="status" aria-label={label}>
      {[0, 1, 2, 3].map((index) => (
        <span
          key={index}
          className="flex h-7 w-4 items-center justify-center border-2 border-foreground bg-es-yellow motion-safe:animate-loader-stack"
          style={{ animationDelay: `${index * 90}ms` }}
        >
          {index === 3 ? <Coins className="h-3 w-3 stroke-[3]" /> : null}
        </span>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function PhotoSkeletonLoader({ label = "Carregando foto" }: { label?: string }) {
  return (
    <div
      className="relative flex aspect-square w-full min-w-28 items-center justify-center overflow-hidden border-4 border-dashed border-foreground bg-surface-muted shadow-editorial-sm"
      role="status"
      aria-label={label}
    >
      <div className="absolute inset-y-0 -left-1/2 w-1/2 bg-surface/60 motion-safe:animate-loader-scan" />
      <Camera className="h-9 w-9 stroke-[3] opacity-30" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function RankingPodiumLoader({ label = "Carregando ranking" }: { label?: string }) {
  return (
    <div className="grid grid-cols-[1fr_1.25fr_1fr] items-end gap-3" role="status" aria-label={label}>
      {[2, 1, 3].map((rank, index) => (
        <div key={rank} className="flex min-w-0 flex-col items-center gap-2">
          <div
            className="flex h-14 w-14 items-center justify-center border-4 border-foreground bg-surface shadow-editorial-sm motion-safe:animate-loader-pop"
            style={{ animationDelay: `${index * 120}ms` }}
          >
            <Trophy className="h-7 w-7 stroke-[3]" />
          </div>
          <div
            className={`w-full border-4 border-foreground shadow-editorial-sm ${
              rank === 1 ? "h-24 bg-es-green" : rank === 2 ? "h-[4.5rem] bg-es-yellow" : "h-16 bg-es-lilac"
            }`}
          />
          <span className="text-[10px] font-black leading-none">#{rank}</span>
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function TableSkeletonLoader({ rows = 5, label = "Carregando tabela" }: { rows?: number; label?: string }) {
  return (
    <div className="border-4 border-foreground bg-surface shadow-editorial-sm" role="status" aria-label={label}>
      <div className="grid grid-cols-[4rem_1fr_7rem] gap-3 border-b-4 border-foreground bg-background px-4 py-3">
        <span className="h-4 border-2 border-foreground bg-es-lilac" />
        <span className="h-4 border-2 border-foreground bg-surface-muted" />
        <span className="h-4 border-2 border-foreground bg-es-yellow" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="grid grid-cols-[4rem_1fr_7rem] gap-3 border-b-2 border-foreground/10 px-4 py-4 last:border-b-0">
          <span className="h-8 w-8 border-4 border-foreground bg-es-yellow shadow-editorial-sm" />
          <span className="h-5 border-2 border-foreground bg-surface-muted motion-safe:animate-loader-pulse" />
          <span className="h-5 border-2 border-foreground bg-es-blue motion-safe:animate-loader-pulse" style={{ animationDelay: `${index * 80}ms` }} />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function CardSkeletonLoader({
  lines = 2,
  accentClassName = "bg-es-lilac",
  label = "Carregando card",
}: {
  lines?: number;
  accentClassName?: string;
  label?: string;
}) {
  return (
    <div className="border-4 border-foreground bg-surface p-4 shadow-editorial-sm" role="status" aria-label={label}>
      <div className={`mb-4 h-2 w-full border-b-4 border-foreground ${accentClassName}`} />
      <div className="flex flex-col gap-3">
        <div className="h-5 w-2/3 border-2 border-foreground bg-surface-muted motion-safe:animate-loader-pulse" />
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className={`h-4 border-2 border-foreground bg-background motion-safe:animate-loader-pulse ${index === lines - 1 ? "w-3/4" : "w-full"}`}
            style={{ animationDelay: `${index * 90}ms` }}
          />
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function PageLoader({ title = "Carregando", subtitle = "Preparando os dados da classe" }: { title?: string; subtitle?: string }) {
  return (
    <section className="mx-auto flex min-h-[55svh] w-full max-w-5xl items-center justify-center px-4 py-10" role="status" aria-live="polite">
      <div className="w-full border-4 border-foreground bg-surface p-5 shadow-editorial md:p-7">
        <div className="mb-8 flex items-start justify-between gap-4 border-b-4 border-foreground pb-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-45">Escola Sabatina</p>
            <h2 className="mt-2 text-4xl font-black uppercase leading-none tracking-tighter md:text-6xl">
              {title}
            </h2>
            <p className="mt-3 text-[11px] font-black uppercase tracking-[0.16em] opacity-50">
              {subtitle}
            </p>
          </div>
          <div className="h-12 w-12 border-4 border-foreground bg-es-lilac shadow-editorial-sm motion-safe:animate-loader-pop" />
        </div>
        <div className="grid gap-5 md:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
            <CardSkeletonLoader accentClassName="bg-es-blue" />
            <CardSkeletonLoader accentClassName="bg-es-orange" />
            <CardSkeletonLoader accentClassName="bg-es-green" />
          </div>
          <div className="border-4 border-foreground bg-background p-4 shadow-editorial-sm">
            <div className="mb-4 h-6 w-1/3 border-2 border-foreground bg-surface-muted motion-safe:animate-loader-pulse" />
            <div className="grid gap-3">
              <div className="h-16 border-4 border-foreground bg-surface motion-safe:animate-loader-pulse" />
              <div className="h-16 border-4 border-foreground bg-surface motion-safe:animate-loader-pulse" style={{ animationDelay: "100ms" }} />
              <div className="h-16 border-4 border-foreground bg-surface motion-safe:animate-loader-pulse" style={{ animationDelay: "200ms" }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
