import { PageLoader, RankingPodiumLoader, SabbathProgressLoader, TableSkeletonLoader } from "@/components/ui/AppLoader";
import { pageShellClass } from "@/components/ui/design-system";

export default function RelatoriosLoading() {
  return (
    <div className={pageShellClass}>
      <PageLoader title="Relatórios" subtitle="Conferindo dados do trimestre" />
      <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-5 px-4 pb-10 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="border-4 border-foreground bg-surface p-5 shadow-editorial">
          <RankingPodiumLoader />
        </div>
        <div className="border-4 border-foreground bg-surface p-5 shadow-editorial">
          <SabbathProgressLoader />
        </div>
        <div className="xl:col-span-2">
          <TableSkeletonLoader rows={4} />
        </div>
      </section>
    </div>
  );
}
