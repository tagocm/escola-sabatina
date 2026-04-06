import { getGuardianStudents } from "@/app/actions/guardians";
import Link from "next/link";
import Image from "next/image";
import { UserCircle, UserPlus } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import {
  emptyStateClass,
  inlinePrimaryActionClass,
  surfaceSoftClass,
} from "@/components/ui/design-system";
import { getStudentPhotoSrc } from "@/lib/storage/student-photos";

interface Student {
  id: string;
  full_name: string;
  photo_url: string | null;
  birth_date: string | null;
  sex: string | null;
  class_id: string | null;
  classes: { id: string; name: string } | null;
}

export default async function GuardianFilhosPage() {
  const students = (await getGuardianStudents()) as unknown as Student[];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
        <PageHeader
          title="Meus Filhos"
          subtitle="Visualize e gerencie os dependentes já cadastrados"
          backHref="/responsavel"
          backLabel="Voltar ao Painel"
        />
        
        <Link
          href="/responsavel/filhos/novo"
          className={`${inlinePrimaryActionClass} w-full md:w-auto`}
        >
          <UserPlus className="w-5 h-5 stroke-[3]" />
          Cadastrar Filho
        </Link>
      </div>

      {students.length === 0 ? (
        <div className={`${emptyStateClass} opacity-80`}>
          <p className="font-black uppercase text-xl">Nenhum filho cadastrado ainda.</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">
            Clique em &quot;Cadastrar Filho&quot; para começar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 md:gap-6">
          {students.map((student) => {
            const photoSrc = getStudentPhotoSrc(student.id, student.photo_url);

            return (
              <Link
                key={student.id}
                href={`/responsavel/filhos/${student.id}`}
                className={`${surfaceSoftClass} p-4 md:p-6 flex items-center gap-4 md:gap-6 hover:bg-background transition-colors group`}
              >
                <div className="relative w-20 h-20 border-4 border-foreground overflow-hidden flex items-center justify-center bg-background shrink-0">
                  {photoSrc ? (
                    <Image
                      src={photoSrc}
                      alt={student.full_name}
                      fill
                      unoptimized
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : (
                    <UserCircle className="w-10 h-10 opacity-20" />
                  )}
                </div>
                
                <div className="flex flex-col gap-1 flex-1">
                  <span className="text-lg font-black uppercase tracking-tight">{student.full_name}</span>
                  {student.classes ? (
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-es-green border-2 border-foreground px-2 py-0.5 inline-block w-fit shadow-editorial-sm">
                      {student.classes.name}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-es-yellow border-2 border-foreground px-2 py-0.5 inline-block w-fit shadow-editorial-sm">
                      Sem Classe
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
