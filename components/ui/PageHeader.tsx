import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  subtitleAccessory?: ReactNode;
  backHref?: string;
  backLabel?: string;
}

export default function PageHeader({
  title,
  subtitle,
  subtitleAccessory,
  backHref,
  backLabel,
}: PageHeaderProps) {
  return (
    <div className="flex w-full flex-col gap-3">
      {backHref && (
        <Link 
          href={backHref} 
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] opacity-40 transition-opacity hover:opacity-100"
        >
          <ArrowLeft className="w-3 h-3" />
          {backLabel || "Voltar ao Painel"}
        </Link>
      )}
      <div className="flex max-w-3xl flex-col text-left">
        <h1 className="text-[clamp(2rem,9vw,3.25rem)] font-black uppercase tracking-tighter leading-none text-foreground">
          {title}
        </h1>
        <div className="mt-1 flex max-w-2xl flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-[10px] font-bold uppercase leading-relaxed tracking-[0.16em] opacity-40 md:text-[11px]">
            {subtitle}
          </p>
          {subtitleAccessory ? (
            <div className="shrink-0">{subtitleAccessory}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
