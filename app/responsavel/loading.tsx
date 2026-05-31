import { PageLoader, PhotoSkeletonLoader, TableSkeletonLoader } from "@/components/ui/AppLoader";
import { pageShellClass } from "@/components/ui/design-system";

export default function ResponsavelLoading() {
  return (
    <div className={pageShellClass}>
      <PageLoader title="Responsável" subtitle="Carregando acompanhamento" />
      <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-5 px-4 pb-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="border-4 border-foreground bg-surface p-3 shadow-editorial-sm">
              <PhotoSkeletonLoader label="Carregando dependente" />
            </div>
          ))}
        </div>
        <TableSkeletonLoader rows={4} label="Carregando acompanhamento" />
      </section>
    </div>
  );
}
