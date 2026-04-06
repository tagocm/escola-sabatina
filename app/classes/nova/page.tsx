import ClassForm from "@/components/ui/ClassForm";
import { createClassAction } from "@/app/actions/classes";
import Header from "@/components/ui/Header";
import PageHeader from "@/components/ui/PageHeader";
import { pageMainClass, pageShellClass, surfaceClass } from "@/components/ui/design-system";

export default function NovaClassePage() {
  return (
    <div className={pageShellClass}>
      
      <Header />

      <main className={pageMainClass}>
        <PageHeader 
          title="Nova Unidade"
          subtitle="Crie uma nova classe de Escola Sabatina para a sua igreja"
          backHref="/classes"
          backLabel="Unidades"
        />

        <div className={`${surfaceClass} mt-2 p-4 md:p-8 lg:p-10`}>
          <ClassForm action={createClassAction} />
        </div>
      </main>
    </div>
  );
}
