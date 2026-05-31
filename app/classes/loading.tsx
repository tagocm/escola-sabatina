import { CardSkeletonLoader, PageLoader } from "@/components/ui/AppLoader";
import { pageShellClass } from "@/components/ui/design-system";

export default function ClassesLoading() {
  return (
    <div className={pageShellClass}>
      <PageLoader title="Classes" subtitle="Carregando unidades e professores" />
      <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-5 px-4 pb-10 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <CardSkeletonLoader
            key={index}
            lines={3}
            accentClassName={index % 3 === 0 ? "bg-es-blue" : index % 3 === 1 ? "bg-es-yellow" : "bg-es-green"}
            label="Carregando classe"
          />
        ))}
      </section>
    </div>
  );
}
