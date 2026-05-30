import Link from "next/link";
import { Plus, Users, LayoutList } from "lucide-react";
import { getClasses } from "@/app/actions/classes";
import InviteButton from "@/components/ui/InviteButton";
import Header from "@/components/ui/Header";
import PageHeader from "@/components/ui/PageHeader";
import { pageMainClass, pageShellClass } from "@/components/ui/design-system";

export default async function ClassesPage() {
  const classes = await getClasses();

  return (
    <div className={pageShellClass}>
      
      <Header />

      <main className={pageMainClass}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
          <PageHeader 
            title="Minhas Unidades"
            subtitle="Gerencie as classes da Escola Sabatina sob sua coordenação"
            backHref="/"
            backLabel="Voltar ao Painel"
          />

          <Link 
            href="/classes/nova"
            className="min-h-12 w-full shrink-0 bg-es-lilac border-4 border-foreground px-6 text-[11px] font-black uppercase tracking-[0.16em] text-foreground shadow-editorial transition-all hover:shadow-editorial-hover active:translate-y-0.5 active:translate-x-0.5 md:w-auto md:px-8 md:text-sm flex items-center justify-center gap-3 cursor-pointer"
          >
            <Plus className="w-5 h-5 stroke-[3]" />
            Nova Unidade
          </Link>
        </div>

        {classes.length === 0 ? (
          <div className="w-full bg-surface border-4 border-foreground px-6 py-10 md:p-16 flex flex-col items-center justify-center text-center gap-6 shadow-editorial">
            <LayoutList className="w-16 h-16 stroke-[1.5] opacity-20" />
            <h2 className="text-xl font-black uppercase tracking-tighter text-foreground">Nenhuma classe encontrada</h2>
            <Link 
              href="/classes/nova"
              className="px-8 py-3 bg-es-orange border-4 border-foreground font-black uppercase tracking-widest text-xs shadow-editorial-sm hover:translate-y-1 transition-all"
            >
              Criar Primeira Classe
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 md:gap-6">
            {classes.map((cls: {
              id: string;
              name: string;
              is_active: boolean;
              professoresCount: number;
              alunosCount: number;
            }) => (
              <div 
                key={cls.id} 
                className={`group bg-surface border-4 border-foreground shadow-editorial-sm flex flex-col transition-all ${
                  !cls.is_active ? "opacity-60 grayscale-[50%]" : "hover:shadow-editorial hover:translate-y-0.5"
                }`}
              >
                <div className="p-6 flex-1 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-[20px] font-black uppercase tracking-tighter leading-none line-clamp-2">
                      {cls.name}
                    </h2>
                    {!cls.is_active && (
                      <span className="bg-foreground text-surface text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 border-2 border-foreground shrink-0">
                        OFF
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-6 border-t-2 border-foreground/5 pt-4">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black uppercase tracking-widest text-foreground/30">Profs</span>
                      <span className="text-lg font-black leading-none mt-1">{cls.professoresCount}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black uppercase tracking-widest text-foreground/30">Alunos</span>
                      <span className="text-lg font-black leading-none mt-1">{cls.alunosCount}</span>
                    </div>
                  </div>

                  <div className="mt-2">
                    <InviteButton classId={cls.id} />
                  </div>
                </div>

                <div className="border-t-4 border-foreground flex h-12">
                  <Link 
                    href={`/classes/${cls.id}`}
                    className="flex-1 bg-surface font-black uppercase tracking-widest text-[10px] flex items-center justify-center hover:bg-background transition-colors"
                  >
                    Editar
                  </Link>
                  <Link 
                    href={`/classes/${cls.id}/alunos`}
                    className="flex-1 bg-es-yellow border-l-4 border-foreground font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-es-yellow/80 transition-colors"
                  >
                    <Users className="w-3.5 h-3.5 stroke-[3]" />
                    Acessar
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
