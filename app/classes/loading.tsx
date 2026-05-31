import { PageLoader, SabbathProgressLoader } from "@/components/ui/AppLoader";
import { pageShellClass } from "@/components/ui/design-system";

export default function ClassesLoading() {
  return (
    <div className={pageShellClass}>
      <PageLoader title="Classes" subtitle="Carregando unidades e professores" />
      <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-5 px-4 pb-10 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="border-4 border-foreground bg-surface p-5 shadow-editorial-sm">
            <SabbathProgressLoader label="Carregando classe" />
            <div className="mt-5 h-6 border-2 border-foreground bg-surface-muted" />
          </div>
        ))}
      </section>
    </div>
  );
}
