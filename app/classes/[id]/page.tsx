import ClassForm from "@/components/ui/ClassForm";
import {
  getClassById,
  getClassOptions,
  getClassWeeklyBibleVerses,
  getPendingEnrollmentRequests,
  transferStudentsToClassAction,
  updateClassAction,
} from "@/app/actions/classes";
import { getScoringRules } from "@/app/actions/scoring";
import { getStudents } from "@/app/actions/students";
import { notFound } from "next/navigation";
import ScoringSection from "@/components/ui/ScoringSection";
import EnrollmentRequestCard from "@/components/ui/EnrollmentRequestCard";
import Header from "@/components/ui/Header";
import PageHeader from "@/components/ui/PageHeader";
import ClassTransferForm from "@/components/ui/ClassTransferForm";
import ResponsibilityTemplateSection from "@/components/ui/ResponsibilityTemplateSection";
import {
  createResponsibilityTemplateAction,
  deleteResponsibilityTemplateAction,
  getResponsibilityTemplates,
} from "@/app/actions/responsibilities";
import WeeklyBibleVerseSection from "@/components/ui/WeeklyBibleVerseSection";
import { pageMainClass, pageShellClass, surfaceClass } from "@/components/ui/design-system";

interface Params {
  params: Promise<{ id: string }>;
}

export default async function EditarClassePage({ params }: Params) {
  const { id } = await params;
  const [
    classData,
    scoringRules,
    pendingRequests,
    classOptions,
    classStudents,
    responsibilityTemplates,
    weeklyBibleVerses,
  ] = await Promise.all([
    getClassById(id),
    getScoringRules(id),
    getPendingEnrollmentRequests(id),
    getClassOptions(),
    getStudents(id),
    getResponsibilityTemplates(id),
    getClassWeeklyBibleVerses(id),
  ]);

  if (!classData) {
    notFound();
  }

  const updateAction = updateClassAction.bind(null, id);
  const transferAction = transferStudentsToClassAction.bind(null, id);
  const createTemplateAction = createResponsibilityTemplateAction.bind(null, id);
  const deleteTemplateAction = deleteResponsibilityTemplateAction.bind(null, id);
  const destinationClasses = (Array.isArray(classOptions) ? classOptions : [])
    .filter((cls: { id: string; is_active?: boolean }) => cls.id !== id && cls.is_active !== false);
  const transferableStudentCount = Array.isArray(classStudents) ? classStudents.length : 0;

  return (
    <div className={pageShellClass}>
      
      <Header />

      <main className={pageMainClass}>
        <PageHeader
          title={classData.name}
          subtitle="Configurações da unidade e critérios de pontuação"
          backHref="/classes"
          backLabel="Voltar às Classes"
        />

        <div className="flex flex-col gap-12">
          
          {/* SEÇÃO 1 — DADOS DA CLASSE */}
          <section id="responsibilities-section" className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
               <div className="w-2 h-6 bg-es-orange border-2 border-foreground" />
               <h3 className="text-xl font-black uppercase tracking-tighter">Informações da Classe</h3>
            </div>
            <div className={`${surfaceClass} p-4 md:p-8 lg:p-10`}>
              <ClassForm initialData={classData} action={updateAction} />
            </div>
          </section>

          <section id="weekly-bible-verse-section" className="flex flex-col gap-5 scroll-mt-6">
            <div className="flex items-center gap-3">
              <div className="h-6 w-2 border-2 border-foreground bg-es-yellow" />
              <h3 className="text-xl font-black uppercase tracking-tighter">
                Verso Bíblico da Semana
              </h3>
            </div>
            <div className={`${surfaceClass} p-4 md:p-8 lg:p-10`}>
              <WeeklyBibleVerseSection classId={id} verses={weeklyBibleVerses} />
            </div>
          </section>

          <section className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
               <div className="w-2 h-6 bg-es-yellow border-2 border-foreground" />
               <h3 className="text-xl font-black uppercase tracking-tighter">Mudança de Classe</h3>
            </div>
            <div className={`${surfaceClass} p-4 md:p-8 lg:p-10`}>
              <ClassTransferForm
                currentClassName={classData.name}
                studentCount={transferableStudentCount}
                destinationClasses={destinationClasses}
                action={transferAction}
              />
            </div>
          </section>

          {/* SEÇÃO 2 — ITENS DE AVALIAÇÃO NA CHEGADA */}
          <section className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
               <div className="w-2 h-6 bg-es-blue border-2 border-foreground" />
               <h3 className="text-xl font-black uppercase tracking-tighter text-foreground">Critérios de Avaliação</h3>
            </div>
            <div className={`${surfaceClass} p-4 md:p-8 lg:p-10`}>
               <ScoringSection classId={id} rules={scoringRules} />
            </div>
          </section>

          <section className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-2 h-6 bg-es-green border-2 border-foreground" />
              <h3 className="text-xl font-black uppercase tracking-tighter text-foreground">Responsabilidades dos Sábados</h3>
            </div>
            <div className={`${surfaceClass} p-4 md:p-8 lg:p-10`}>
              <ResponsibilityTemplateSection
                templates={responsibilityTemplates as never}
                createAction={createTemplateAction}
                deleteAction={deleteTemplateAction}
              />
            </div>
          </section>

          {/* SEÇÃO 3 — SOLICITAÇÕES DE MATRÍCULA */}
          {pendingRequests.length > 0 && (
            <section className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="w-2 h-6 bg-es-lilac border-2 border-foreground" />
                <h3 className="text-xl font-black uppercase tracking-tighter text-foreground">Solicitações Pendentes</h3>
                <div className="bg-es-lilac border-4 border-foreground px-2 py-0.5 font-black text-xs shadow-editorial-sm">
                  {pendingRequests.length}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                {pendingRequests.map((req: Record<string, unknown>) => (
                  <EnrollmentRequestCard key={req.id as string} request={req as never} />
                ))}
              </div>
            </section>
          )}

        </div>
      </main>
    </div>
  );
}
