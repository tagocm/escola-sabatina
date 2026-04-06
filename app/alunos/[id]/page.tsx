import { deactivateStudentByTeacher, getStudentById } from "@/app/actions/students";
import { getClassOptions } from "@/app/actions/classes";
import { notFound } from "next/navigation";
import StudentForm from "@/components/ui/StudentForm";
import Header from "@/components/ui/Header";
import PageHeader from "@/components/ui/PageHeader";
import TeacherDeactivateStudentButton from "@/components/ui/TeacherDeactivateStudentButton";
import { pageMainClass, pageShellClass, surfaceClass } from "@/components/ui/design-system";

export default async function EditarAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [student, classes] = await Promise.all([getStudentById(id), getClassOptions()]);
  const availableClasses = Array.isArray(classes) ? classes : [];

  if (!student) notFound();

  return (
    <div className={pageShellClass}>
      
      <Header />

      <main className={pageMainClass}>
        <PageHeader 
          title="Editar Aluno"
          subtitle={`Atualize as informações de ${student.full_name}`}
          backHref="/alunos"
          backLabel="Matrículas"
        />

        <div className={`${surfaceClass} p-4 md:p-8 lg:p-10`}>
          <StudentForm initialData={student} classes={availableClasses} />

          <div className="mt-6 flex justify-end border-t-4 border-dashed border-foreground pt-6">
            <form action={deactivateStudentByTeacher.bind(null, student.id)}>
              <TeacherDeactivateStudentButton studentName={student.full_name} />
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
