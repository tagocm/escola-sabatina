import Link from "next/link";
import { ArrowUpRight, Trophy } from "lucide-react";
import Header from "@/components/ui/Header";
import PageHeader from "@/components/ui/PageHeader";
import { pageMainClass, pageShellClass, surfaceClass } from "@/components/ui/design-system";

export default async function RankingPontuacaoPage() {
  return (
    <div className={pageShellClass}>
      <Header />

      <main className={pageMainClass}>
        <PageHeader
          title="Ranking de Pontuação"
          subtitle="Pódio, médias e evolução trimestral da classe"
          backHref="/"
          backLabel="Voltar ao Painel"
        />

        <section className={`${surfaceClass} flex flex-col gap-6 p-6 md:p-8`}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center border-4 border-foreground bg-es-lilac shadow-editorial-sm">
              <Trophy className="h-5 w-5 stroke-[3]" />
            </div>
            <div className="flex flex-col text-left">
              <h2 className="text-2xl font-black uppercase leading-none tracking-tighter">
                Ranking trimestral
              </h2>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] opacity-40">
                Ciclo fixo de 13 sábados
              </span>
            </div>
          </div>

          <div className="border-4 border-dashed border-foreground/30 bg-background p-6 text-left shadow-editorial-sm md:p-8">
            <p className="text-lg font-black uppercase leading-tight tracking-tight">
              A tela completa do ranking será montada aqui.
            </p>
            <p className="mt-3 max-w-2xl text-[11px] font-bold uppercase leading-relaxed tracking-[0.14em] opacity-50">
              O card já aponta para a rota definitiva. A próxima etapa é conectar os dados do trimestre,
              pódio, gráficos e tabela completa conforme a spec aprovada.
            </p>
          </div>

          <Link
            href="/relatorios/lancamento"
            className="inline-flex min-h-12 w-full items-center justify-between gap-3 border-4 border-foreground bg-es-blue px-5 text-[11px] font-black uppercase tracking-[0.16em] shadow-editorial transition-all hover:shadow-editorial-hover active:translate-x-0.5 active:translate-y-0.5 active:shadow-none sm:w-auto"
          >
            Lançar pontuações
            <ArrowUpRight className="h-5 w-5 stroke-[3]" />
          </Link>
        </section>
      </main>
    </div>
  );
}
