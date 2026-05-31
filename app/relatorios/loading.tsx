import { CardSkeletonLoader, PageLoader, TableSkeletonLoader } from "@/components/ui/AppLoader";
import { pageShellClass } from "@/components/ui/design-system";

export default function RelatoriosLoading() {
  return (
    <div className={pageShellClass}>
      <PageLoader title="Relatórios" subtitle="Conferindo dados do trimestre" />
      <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-5 px-4 pb-10 xl:grid-cols-[0.8fr_1.2fr]">
        <CardSkeletonLoader lines={3} accentClassName="bg-es-blue" label="Carregando resumo do relatório" />
        <CardSkeletonLoader lines={4} accentClassName="bg-es-orange" label="Carregando dados do relatório" />
        <div className="xl:col-span-2">
          <TableSkeletonLoader rows={4} />
        </div>
      </section>
    </div>
  );
}
