import { PageLoader, PhotoSkeletonLoader } from "@/components/ui/AppLoader";
import { pageShellClass } from "@/components/ui/design-system";

export default function AlunosLoading() {
  return (
    <div className={pageShellClass}>
      <PageLoader title="Alunos" subtitle="Carregando fotos e cadastros" />
      <section className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-5 px-4 pb-10 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="border-4 border-foreground bg-surface p-3 shadow-editorial-sm">
            <PhotoSkeletonLoader label="Carregando aluno" />
            <div className="mt-3 h-4 border-2 border-foreground bg-surface-muted" />
          </div>
        ))}
      </section>
    </div>
  );
}
