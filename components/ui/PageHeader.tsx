import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  backHref?: string;
  backLabel?: string;
}

export default function PageHeader({ title, subtitle, backHref, backLabel }: PageHeaderProps) {
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
        <p className="mt-1 max-w-2xl text-[10px] font-bold uppercase tracking-[0.16em] leading-relaxed opacity-40 md:text-[11px]">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
