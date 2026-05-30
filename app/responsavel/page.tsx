import Link from "next/link";
import Image from "next/image";
import { deactivateGuardianStudent, getGuardianStudents, getMyEnrollmentRequests } from "@/app/actions/guardians";
import { UserPlus, Settings, Clock, CheckCircle, AlertCircle, Plus, Activity } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import DeactivateStudentButton from "@/components/ui/DeactivateStudentButton";
import { getStudentPhotoSrc } from "@/lib/storage/student-photos";
import {
  emptyStateClass,
  gridCardClass,
  inlinePrimaryActionClass,
  stackedPageClass,
} from "@/components/ui/design-system";

interface GuardianStudent {
  id: string;
  full_name: string;
  photo_url: string | null;
  class_id: string | null;
  classes?: {
    name?: string | null;
  } | null;
}

interface GuardianRequest {
  status: string;
  students?: {
    id: string;
  } | {
    id: string;
  }[] | null;
  classes?: {
    name?: string | null;
  } | {
    name?: string | null;
  }[] | null;
}

export default async function GuardianDashboard() {
  const [students, requests] = await Promise.all([
    getGuardianStudents(),
    getMyEnrollmentRequests(),
  ]);
  const guardianStudents = students as unknown as GuardianStudent[];
  const guardianRequests = requests as unknown as GuardianRequest[];

  // Map students to their requests status
  const studentsWithStatus = guardianStudents.map((student) => {
    if (student.class_id) {
      return {
        ...student,
        status: "matriculado",
        statusLabel: "Matriculado",
        statusColor: "bg-es-green",
        statusIcon: CheckCircle,
        className: student.classes?.name || "Classe Indefinida",
      };
    }

    const pendingRequest = guardianRequests.find(
      (request) => {
        const requestStudent = Array.isArray(request.students) ? request.students[0] : request.students;
        return requestStudent?.id === student.id && request.status === "pending";
      }
    );

    if (pendingRequest) {
      const className = Array.isArray(pendingRequest.classes) 
        ? pendingRequest.classes[0]?.name 
        : pendingRequest.classes?.name;

      return {
        ...student,
        status: "pendente",
        statusLabel: "Pendente",
        statusColor: "bg-es-yellow",
        statusIcon: Clock,
        className: className || "Solicitação Enviada",
      };
    }

    return {
      ...student,
      status: "sem_classe",
      statusLabel: "Sem Classe",
      statusColor: "bg-background",
      statusIcon: AlertCircle,
      className: "Aguardando Definição",
    };
  });

  return (
    <div className={stackedPageClass}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="min-w-0 flex-1">
            <PageHeader 
              title="Dependentes"
              subtitle="Acompanhamento e matrícula dos seus filhos"
              backHref="/"
              backLabel="Sair do Portal"
            />
          </div>

          <Link 
            href="/responsavel/filhos/novo"
            className={`${inlinePrimaryActionClass} w-full self-start lg:mt-10 lg:w-auto`}
          >
            <UserPlus className="w-5 h-5 stroke-[3]" />
            Novo Dependente
          </Link>
        </div>

        {studentsWithStatus.length === 0 ? (
          <div className={emptyStateClass}>
            <div className="w-20 h-20 bg-background border-4 border-foreground flex items-center justify-center shadow-editorial-sm">
              <Plus className="w-10 h-10 stroke-[3] text-es-lilac" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-black uppercase tracking-tighter">Nenhum Dependente</h2>
              <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest">
                Você ainda não cadastrou nenhum dependente no sistema
              </p>
            </div>
            <Link 
              href="/responsavel/filhos/novo"
              className="px-8 py-3 bg-es-orange border-4 border-foreground font-black uppercase tracking-widest text-xs shadow-editorial-sm hover:translate-y-1 transition-all"
            >
              Cadastrar Primeiro Filho
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 md:gap-6">
            {studentsWithStatus.map((student) => {
              const StatusIcon = student.statusIcon;
              const photoSrc = getStudentPhotoSrc(student.id, student.photo_url);
              
              return (
                <div 
                  key={student.id}
                  className={`${gridCardClass} relative w-full min-w-0`}
                >
                  <form action={deactivateGuardianStudent.bind(null, student.id)} className="absolute right-3 top-3 z-10">
                    <DeactivateStudentButton studentName={student.full_name} />
                  </form>

                  <div className="p-4 flex flex-col gap-3 flex-grow">
                    <div className="aspect-[0.9] relative border-4 border-foreground bg-background shadow-editorial-sm overflow-hidden">
                      {photoSrc ? (
                        <Image
                          src={photoSrc} 
                          alt={`Foto de ${student.full_name}`}
                          fill
                          unoptimized
                          sizes="(max-width: 768px) 100vw, 320px"
                          className="object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-background p-4 opacity-5">
                           <UserPlus className="w-16 h-16 stroke-[1]" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col overflow-hidden">
                      <h3 className="text-[18px] font-black uppercase tracking-tight leading-none truncate">
                        {student.full_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-40 shrink-0">Classe:</span>
                        <span className="text-[9px] font-bold uppercase truncate">{student.className}</span>
                      </div>
                    </div>

                    <div className={`${student.statusColor} border-4 border-foreground px-3 py-2 flex items-center gap-2 shadow-editorial-sm mt-auto`}>
                      <StatusIcon className="w-3.5 h-3.5 stroke-[3]" />
                      <span className="text-[9px] font-black uppercase tracking-widest">{student.statusLabel}</span>
                    </div>
                  </div>

                  <div className="border-t-4 border-foreground grid grid-cols-2 h-10">
                    <Link 
                      href={`/responsavel/filhos/${student.id}`}
                      className="bg-surface flex items-center justify-center gap-2 hover:bg-background transition-colors"
                    >
                      <Settings className="w-3 h-3 stroke-[3]" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Dados</span>
                    </Link>

                    <Link 
                      href={`/responsavel/filhos/${student.id}/acompanhe`}
                      className="bg-es-blue border-l-4 border-foreground flex items-center justify-center gap-2 hover:opacity-80 transition-all"
                    >
                      <>
                        <Activity className="w-3 h-3 stroke-[3]" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Acompanhe</span>
                      </>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t-4 border-dashed border-foreground pt-6 opacity-60 transition-opacity hover:opacity-100 md:mt-8 md:flex-row md:gap-6 md:pt-8">
          <p className="max-w-sm text-center text-[9px] font-black uppercase tracking-widest leading-relaxed md:text-left">
            Dúvidas sobre o funcionamento das classes? Entre em contato com a equipe de coordenação.
          </p>
          <div className="border-2 border-foreground bg-surface px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] shadow-editorial-sm">
            Portal da Família v2.0
          </div>
        </div>
    </div>
  );
}
