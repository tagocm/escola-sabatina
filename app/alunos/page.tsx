import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, UserPlus, Phone, UserCircle, BellRing, RotateCcw } from "lucide-react";
import { getStudents, toggleStudentStatus } from "@/app/actions/students";
import { getActiveClassContext, getPendingEnrollmentRequests } from "@/app/actions/classes";
import Header from "@/components/ui/Header";
import PageHeader from "@/components/ui/PageHeader";
import EnrollmentRequestCard from "@/components/ui/EnrollmentRequestCard";
import { getStudentPhotoSrc } from "@/lib/storage/student-photos";
import { pageMainClass, pageShellClass } from "@/components/ui/design-system";

interface PendingRequest {
  id: string;
  status: string;
  created_at: string;
  students: {
    id: string;
    full_name: string;
    photo_url: string | null;
    birth_date: string | null;
    sex: string | null;
  } | null;
  requested_by_profile: {
    full_name: string | null;
    whatsapp: string | null;
  } | null;
}

interface PendingRequestRow {
  id: string;
  status: string;
  created_at: string;
  students: PendingRequest["students"] | PendingRequest["students"][];
  requested_by_profile: PendingRequest["requested_by_profile"] | PendingRequest["requested_by_profile"][];
}

export default async function AlunosPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ q?: string }> 
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const currentClassId = await getActiveClassContext();
  const q = (await searchParams).q || "";
  
  if (!currentClassId) {
     redirect("/classes");
  }

  const [allStudents, pendingRequestsData] = await Promise.all([
    getStudents(currentClassId, true),
    getPendingEnrollmentRequests(currentClassId),
  ]);
  const students = allStudents.filter((s: { full_name: string; is_active: boolean }) =>
    s.is_active && s.full_name.toLowerCase().includes(q.toLowerCase())
  );
  const inactiveStudents = allStudents.filter((s: { full_name: string; is_active: boolean }) =>
    !s.is_active && s.full_name.toLowerCase().includes(q.toLowerCase())
  );
  const visibleStudents = students.filter((s: { full_name: string }) => 
    s.full_name.toLowerCase().includes(q.toLowerCase())
  );
  const pendingRequests = (pendingRequestsData as unknown as PendingRequestRow[])
    .map((request) => ({
      ...request,
      students: Array.isArray(request.students) ? request.students[0] || null : request.students,
      requested_by_profile: Array.isArray(request.requested_by_profile)
        ? request.requested_by_profile[0] || null
        : request.requested_by_profile,
    }))
    .filter((request): request is PendingRequest =>
      Boolean(request.students?.full_name?.toLowerCase().includes(q.toLowerCase()))
    );
  const hasResults = visibleStudents.length > 0 || pendingRequests.length > 0 || inactiveStudents.length > 0;

  return (
    <div className={pageShellClass}>
      
      <Header />

      <main className={pageMainClass}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
          <PageHeader 
            title="Gestão de Alunos"
            subtitle="Visualize, edite e gerencie todos os alunos matriculados na sua unidade"
            backHref="/"
            backLabel="Voltar ao Painel"
          />

          <Link 
            href="/alunos/novo"
            className="min-h-12 w-full shrink-0 bg-es-lilac border-4 border-foreground px-6 text-[11px] font-black uppercase tracking-[0.16em] text-foreground shadow-editorial transition-all hover:shadow-editorial-hover active:translate-y-0.5 active:translate-x-0.5 md:w-auto md:px-8 md:text-sm flex items-center justify-center gap-3 cursor-pointer"
          >
            <UserPlus className="w-5 h-5 stroke-[3]" />
            Novo Aluno
          </Link>
        </div>

        <div className="flex h-14 overflow-hidden border-4 border-foreground bg-surface p-1 shadow-editorial-sm">
          <div className="flex w-12 items-center justify-center border-r-4 border-foreground bg-es-yellow">
             <Search className="w-5 h-5 stroke-[3]" />
          </div>
          <form className="flex-1">
            <input 
              name="q"
              defaultValue={q}
              placeholder="BUSCAR ALUNO PELO NOME..."
              className="h-full w-full px-4 text-[11px] font-black uppercase tracking-[0.16em] outline-none placeholder:opacity-20 md:px-6"
            />
          </form>
        </div>

        {!hasResults ? (
          <div className="w-full bg-surface border-4 border-foreground px-6 py-10 md:p-16 flex flex-col items-center justify-center text-center gap-6 shadow-editorial">
            <UserPlus className="w-20 h-20 stroke-[1.5] opacity-20" />
            <h2 className="text-xl font-black uppercase tracking-tighter">Nenhum aluno encontrado</h2>
            <Link 
              href="/alunos/novo"
              className="px-8 py-3 bg-es-orange border-4 border-foreground font-black uppercase tracking-widest text-xs shadow-editorial-sm hover:translate-y-1 transition-all"
            >
              Fazer Primeira Matrícula
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {pendingRequests.length > 0 && (
              <section className="flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-6 bg-es-lilac border-2 border-foreground" />
                  <h2 className="text-xl font-black uppercase tracking-tighter">Solicitações Pendentes</h2>
                  <div className="bg-es-lilac border-4 border-foreground px-2 py-0.5 font-black text-xs shadow-editorial-sm">
                    {pendingRequests.length}
                  </div>
                </div>

                <div className="bg-surface border-4 border-foreground p-5 md:p-6 shadow-editorial flex flex-col gap-4">
                  <div className="flex items-center gap-3 opacity-60">
                    <BellRing className="w-4 h-4 stroke-[3]" />
                    <p className="text-[10px] font-black uppercase tracking-[0.18em]">
                      Alunos aguardando aprovação para entrar nesta unidade
                    </p>
                  </div>

                  <div className="flex flex-col gap-4">
                    {pendingRequests.map((request) => (
                      <EnrollmentRequestCard key={request.id} request={request} />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {visibleStudents.length > 0 && (
              <section className="flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-6 bg-es-orange border-2 border-foreground" />
                  <h2 className="text-xl font-black uppercase tracking-tighter">Alunos Matriculados</h2>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 md:gap-6">
                  {visibleStudents.map((aluno: { 
                    id: string; 
                    full_name: string; 
                    photo_url: string | null; 
                    guardian_name: string | null; 
                    whatsapp: string | null 
                  }) => {
                    const photoSrc = getStudentPhotoSrc(aluno.id, aluno.photo_url);

                    return (
                      <Link 
                        key={aluno.id}
                        href={`/alunos/${aluno.id}`}
                        className="group bg-surface border-4 border-foreground shadow-editorial-sm p-4 flex items-center gap-4 hover:shadow-editorial hover:translate-y-0.5 active:translate-y-1 transition-all"
                      >
                        <div className="w-16 h-16 bg-background border-4 border-foreground relative overflow-hidden flex items-center justify-center shrink-0">
                           {photoSrc ? (
                             <Image 
                               src={photoSrc} 
                               alt={`Foto de ${aluno.full_name}`}
                               fill
                               unoptimized
                               sizes="64px"
                               className="object-cover transition-all" 
                             />
                           ) : (
                             <UserCircle className="w-10 h-10 stroke-[1.5] opacity-10" />
                           )}
                        </div>
                        <div className="flex-1 flex flex-col min-w-0">
                           <h3 className="text-sm font-black uppercase tracking-tighter leading-none truncate">{aluno.full_name}</h3>
                           <p className="text-[9px] font-bold text-foreground/40 uppercase tracking-widest truncate mt-1">
                              {aluno.guardian_name || "Sem responsável"}
                           </p>
                           <div className="flex items-center gap-2 mt-2">
                              <div className="flex items-center gap-1.5 opacity-60">
                                 <Phone className="w-3 h-3 stroke-[3]" />
                                 <span className="text-[9px] font-black truncate">{aluno.whatsapp || "--"}</span>
                              </div>
                           </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {inactiveStudents.length > 0 && (
              <section className="flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-6 bg-foreground/30 border-2 border-foreground" />
                  <h2 className="text-xl font-black uppercase tracking-tighter">Alunos Inativos</h2>
                  <div className="border-4 border-foreground bg-background px-2 py-0.5 font-black text-xs shadow-editorial-sm">
                    {inactiveStudents.length}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 md:gap-6">
                  {inactiveStudents.map((aluno: {
                    id: string;
                    full_name: string;
                    photo_url: string | null;
                    guardian_name: string | null;
                    whatsapp: string | null;
                  }) => {
                    const photoSrc = getStudentPhotoSrc(aluno.id, aluno.photo_url);

                    return (
                      <div
                        key={aluno.id}
                        className="bg-surface border-4 border-foreground shadow-editorial-sm p-4 flex items-center gap-4 opacity-65"
                      >
                        <div className="w-16 h-16 bg-background border-4 border-foreground relative overflow-hidden flex items-center justify-center shrink-0 grayscale">
                          {photoSrc ? (
                            <Image
                              src={photoSrc}
                              alt={`Foto de ${aluno.full_name}`}
                              fill
                              unoptimized
                              sizes="64px"
                              className="object-cover transition-all"
                            />
                          ) : (
                            <UserCircle className="w-10 h-10 stroke-[1.5] opacity-10" />
                          )}
                        </div>

                        <div className="flex-1 flex flex-col min-w-0">
                          <h3 className="text-sm font-black uppercase tracking-tighter leading-none truncate">{aluno.full_name}</h3>
                          <p className="text-[9px] font-bold text-foreground/40 uppercase tracking-widest truncate mt-1">
                            {aluno.guardian_name || "Sem responsável"}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center gap-1.5 opacity-60">
                              <Phone className="w-3 h-3 stroke-[3]" />
                              <span className="text-[9px] font-black truncate">{aluno.whatsapp || "--"}</span>
                            </div>
                          </div>
                        </div>

                        <form action={toggleStudentStatus.bind(null, aluno.id, true)}>
                          <button
                            type="submit"
                            className="flex items-center gap-2 border-4 border-foreground bg-es-green px-4 py-2 text-[10px] font-black uppercase tracking-widest shadow-editorial-sm transition-all hover:shadow-editorial-hover"
                          >
                            <RotateCcw className="w-3.5 h-3.5 stroke-[3]" />
                            Reativar
                          </button>
                        </form>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
