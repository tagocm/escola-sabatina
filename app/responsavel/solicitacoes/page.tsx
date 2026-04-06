import { getMyEnrollmentRequests } from "@/app/actions/guardians";
import { Clock, Check, X } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { emptyStateClass, listCardClass } from "@/components/ui/design-system";

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Aguardando Aprovação", color: "bg-es-yellow", icon: Clock },
  approved: { label: "Aprovado", color: "bg-es-green", icon: Check },
  rejected: { label: "Rejeitado", color: "bg-red-400", icon: X },
};

export default async function SolicitacoesPage() {
  const requests = await getMyEnrollmentRequests();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Minhas Solicitações"
        subtitle="Acompanhe o status das suas solicitações de matrícula"
        backHref="/responsavel"
        backLabel="Voltar ao Painel"
      />

      {requests.length === 0 ? (
        <div className={`${emptyStateClass} opacity-80`}>
          <p className="font-black uppercase text-xl">Nenhuma solicitação enviada.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {requests.map((req: Record<string, unknown>) => {
            const reqId = req.id as string;
            const reqStatus = req.status as string;
            const status = statusConfig[reqStatus] || statusConfig.pending;
            const StatusIcon = status.icon;

            // Supabase may return these as arrays or objects
            const student = Array.isArray(req.students) ? req.students[0] : req.students;
            const cls = Array.isArray(req.classes) ? req.classes[0] : req.classes;
            const studentObj = student as { full_name?: string } | null;
            const classObj = cls as { name?: string } | null;

            return (
              <div
                key={reqId}
                className={listCardClass}
              >
                <div className="flex flex-col gap-1 flex-1">
                  <span className="text-lg font-black uppercase tracking-tight">
                    {studentObj?.full_name || "—"}
                  </span>
                  <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest">
                    Classe: {classObj?.name || "—"}
                  </span>
                  <span className="text-[9px] font-bold text-foreground/30 uppercase tracking-widest">
                    Enviado em: {new Date(req.created_at as string).toLocaleDateString("pt-BR")}
                  </span>
                </div>

                <div className={`${status.color} border-4 border-foreground px-4 py-2 flex items-center gap-2 shadow-editorial-sm`}>
                  <StatusIcon className="w-4 h-4 stroke-[3]" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{status.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
