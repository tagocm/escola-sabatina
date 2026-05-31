import { CardSkeletonLoader, PageLoader } from "@/components/ui/AppLoader";
import { pageShellClass } from "@/components/ui/design-system";

export default function ResponsabilidadesLoading() {
  return (
    <div className={pageShellClass}>
      <PageLoader title="Agenda" subtitle="Montando tarefas dos sábados" />
      <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-5 px-4 pb-10 xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="min-h-64 border-4 border-foreground bg-background p-4 shadow-editorial-sm">
            <div className="grid gap-3">
              <CardSkeletonLoader lines={2} accentClassName="bg-es-green" label="Carregando atividade" />
              <CardSkeletonLoader lines={2} accentClassName="bg-es-yellow" label="Carregando atividade" />
              <CardSkeletonLoader lines={1} accentClassName="bg-es-blue" label="Carregando atividade" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
