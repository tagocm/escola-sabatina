import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import StudentForm from "@/components/ui/StudentForm";
import { getActiveClassContext, getClassOptions } from "@/app/actions/classes";
import Header from "@/components/ui/Header";
import PageHeader from "@/components/ui/PageHeader";
import { pageMainClass, pageShellClass, surfaceClass } from "@/components/ui/design-system";

export default async function NovoAlunoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [currentClassId, classes] = await Promise.all([
    getActiveClassContext(),
    getClassOptions(),
  ]);

  if (!currentClassId) {
    redirect("/classes");
  }

  return (
    <div className={pageShellClass}>
      
      <Header />

      <main className={pageMainClass}>
        <PageHeader 
          title="Novo Aluno"
          subtitle="Preencha os dados abaixo para matricular um novo estudante na unidade"
          backHref="/alunos"
          backLabel="Matrículas"
        />

        <div className={`${surfaceClass} p-4 md:p-8 lg:p-10`}>
          <StudentForm
            classes={Array.isArray(classes) ? classes : []}
            defaultClassId={currentClassId}
          />
        </div>
      </main>
    </div>
  );
}
