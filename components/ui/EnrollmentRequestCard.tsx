"use client";

import { useTransition } from "react";
import Image from "next/image";
import { approveEnrollmentRequest, rejectEnrollmentRequest } from "@/app/actions/classes";
import { Check, X, UserCircle } from "lucide-react";
import { getStudentPhotoSrc } from "@/lib/storage/student-photos";

interface EnrollmentRequestCardProps {
  request: {
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
  };
}

const statusLabelMap: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-es-yellow" },
  approved: { label: "Aprovado", color: "bg-es-green" },
  rejected: { label: "Rejeitado", color: "bg-red-400" },
};

export default function EnrollmentRequestCard({ request }: EnrollmentRequestCardProps) {
  const [isPending, startTransition] = useTransition();

  const student = request.students;
  const guardian = request.requested_by_profile;
  const statusInfo = statusLabelMap[request.status] || statusLabelMap.pending;
  const photoSrc = student ? getStudentPhotoSrc(student.id, student.photo_url) : null;

  const handleApprove = () => {
    startTransition(async () => {
      await approveEnrollmentRequest(request.id);
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      await rejectEnrollmentRequest(request.id);
    });
  };

  return (
    <div className="bg-white border-4 border-foreground shadow-editorial-sm p-5 flex flex-col md:flex-row md:items-center gap-4">
      {/* Student Info */}
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-14 h-14 border-4 border-foreground overflow-hidden flex items-center justify-center bg-background shrink-0">
          {photoSrc ? (
            <Image
              src={photoSrc}
              alt={student?.full_name || "Aluno"}
              fill
              unoptimized
              sizes="56px"
              className="object-cover"
            />
          ) : (
            <UserCircle className="w-8 h-8 opacity-20" />
          )}
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-black uppercase tracking-tight">
            {student?.full_name || "Aluno sem nome"}
          </span>
          <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest">
            Responsável: {guardian?.full_name || "—"}
          </span>
          {guardian?.whatsapp && (
            <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest">
              WhatsApp: {guardian.whatsapp}
            </span>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div className={`${statusInfo.color} border-2 border-foreground px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-editorial-sm`}>
        {statusInfo.label}
      </div>

      {/* Actions (only for pending) */}
      {request.status === "pending" && (
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            disabled={isPending}
            className="bg-es-green border-4 border-foreground p-3 shadow-editorial-sm hover:shadow-none active:translate-y-0.5 transition-all disabled:opacity-50"
            title="Aprovar Matrícula"
          >
            <Check className="w-5 h-5 stroke-[3]" />
          </button>
          <button
            onClick={handleReject}
            disabled={isPending}
            className="bg-red-400 border-4 border-foreground p-3 shadow-editorial-sm hover:shadow-none active:translate-y-0.5 transition-all disabled:opacity-50"
            title="Rejeitar Solicitação"
          >
            <X className="w-5 h-5 stroke-[3]" />
          </button>
        </div>
      )}
    </div>
  );
}
