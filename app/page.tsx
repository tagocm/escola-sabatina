import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Header from "@/components/ui/Header";
import Link from "next/link";
import { Users, Calendar, ArrowUpRight, HandCoins, CalendarCheck2 } from "lucide-react";
import { getUserRole } from "@/app/actions/guardians";
import { pageMainClass, pageShellClass } from "@/components/ui/design-system";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Guardian redirect: send to dedicated area
  const role = await getUserRole();
  if (role !== "teacher") {
    redirect("/responsavel");
  }

  return (
    <div className={pageShellClass}>

      <Header />
      
      <main className={`${pageMainClass} grid grid-cols-1 gap-5 text-center sm:grid-cols-2 xl:grid-cols-4 md:gap-7`}>
        
        {/* Chamada - Editorial Blue Block */}
         <Link href="/relatorios/lancamento" className="group bg-es-blue border-4 border-foreground shadow-editorial flex flex-col hover:shadow-editorial-hover hover:translate-y-1 hover:translate-x-1 transition-all cursor-pointer overflow-hidden relative">
           <div className="relative z-10 flex h-full flex-col gap-5 p-6 md:p-8">
             <div className="flex h-14 w-14 items-center justify-center border-4 border-foreground bg-surface text-foreground shadow-editorial-sm transition-transform group-hover:-rotate-6 md:h-16 md:w-16">
               <Calendar className="w-8 h-8 stroke-[3]" />
             </div>
             <div className="flex flex-col flex-grow items-start text-left">
               <h2 className="text-[24px] md:text-[28px] font-black text-foreground tracking-tighter uppercase leading-none">Lançar<br/>Chamada</h2>
               <p className="mt-4 border-t-4 border-foreground pt-4 text-[13px] md:text-[15px] font-bold uppercase leading-tight tracking-wide text-foreground">
                 Registre presença e pontuação dos alunos.
               </p>
             </div>
             <div className="self-end mt-4 w-10 h-10 border-4 border-foreground rounded-full flex items-center justify-center bg-surface group-hover:bg-foreground group-hover:text-surface transition-colors">
               <ArrowUpRight className="w-6 h-6 stroke-[3]" />
             </div>
           </div>
        </Link>

        <Link href="/relatorios/ofertas#oferta-section" className="group bg-es-yellow border-4 border-foreground shadow-editorial flex flex-col hover:shadow-editorial-hover hover:translate-y-1 hover:translate-x-1 transition-all cursor-pointer overflow-hidden relative">
          <div className="relative z-10 flex h-full flex-col gap-5 p-6 md:p-8">
            <div className="flex h-14 w-14 items-center justify-center border-4 border-foreground bg-surface text-foreground shadow-editorial-sm transition-transform group-hover:rotate-6 md:h-16 md:w-16">
              <HandCoins className="w-8 h-8 stroke-[3]" />
            </div>
            <div className="flex flex-col flex-grow items-start text-left">
              <h2 className="text-[24px] md:text-[28px] font-black text-foreground tracking-tighter uppercase leading-none">Oferta do<br/>Sábado</h2>
              <p className="mt-4 border-t-4 border-foreground pt-4 text-[13px] md:text-[15px] font-bold uppercase leading-tight tracking-wide text-foreground">
                Registre a arrecadação e compare com a meta da unidade.
              </p>
            </div>
            <div className="self-end mt-4 w-10 h-10 border-4 border-foreground rounded-full flex items-center justify-center bg-surface group-hover:bg-foreground group-hover:text-surface transition-colors">
              <ArrowUpRight className="w-6 h-6 stroke-[3]" />
            </div>
          </div>
        </Link>

        {/* Alunos - Editorial Orange Block */}
         <Link href="/alunos" className="group bg-es-orange border-4 border-foreground shadow-editorial flex flex-col hover:shadow-editorial-hover hover:translate-y-1 hover:translate-x-1 transition-all cursor-pointer overflow-hidden relative">
           <div className="relative z-10 flex h-full flex-col gap-5 p-6 md:p-8">
             <div className="flex h-14 w-14 items-center justify-center border-4 border-foreground bg-surface text-foreground shadow-editorial-sm transition-transform group-hover:rotate-6 md:h-16 md:w-16">
               <Users className="w-8 h-8 stroke-[3]" />
             </div>
             <div className="flex flex-col flex-grow items-start text-left">
               <h2 className="text-[24px] md:text-[28px] font-black text-foreground tracking-tighter uppercase leading-none">Base de<br/>Alunos</h2>
               <p className="mt-4 border-t-4 border-foreground pt-4 text-[13px] md:text-[15px] font-bold uppercase leading-tight tracking-wide text-foreground">
                 Matrículas e chamadas da classe atual.
               </p>
             </div>
             <div className="self-end mt-4 w-10 h-10 border-4 border-foreground rounded-full flex items-center justify-center bg-surface group-hover:bg-foreground group-hover:text-surface transition-colors">
               <ArrowUpRight className="w-6 h-6 stroke-[3]" />
             </div>
           </div>
        </Link>

        <Link href="/responsabilidades" className="group bg-es-green border-4 border-foreground shadow-editorial flex flex-col hover:shadow-editorial-hover hover:translate-y-1 hover:translate-x-1 transition-all cursor-pointer overflow-hidden relative">
          <div className="relative z-10 flex h-full flex-col gap-5 p-6 md:p-8">
            <div className="flex h-14 w-14 items-center justify-center border-4 border-foreground bg-surface text-foreground shadow-editorial-sm transition-transform group-hover:rotate-6 md:h-16 md:w-16">
              <CalendarCheck2 className="w-8 h-8 stroke-[3]" />
            </div>
            <div className="flex flex-col flex-grow items-start text-left">
              <h2 className="text-[24px] md:text-[28px] font-black text-foreground tracking-tighter uppercase leading-none">Agenda de<br/>Responsas</h2>
              <p className="mt-4 border-t-4 border-foreground pt-4 text-[13px] md:text-[15px] font-bold uppercase leading-tight tracking-wide text-foreground">
                Escale tarefas por sábado e sorteie alunos da turma.
              </p>
            </div>
            <div className="self-end mt-4 w-10 h-10 border-4 border-foreground rounded-full flex items-center justify-center bg-surface group-hover:bg-foreground group-hover:text-surface transition-colors">
              <ArrowUpRight className="w-6 h-6 stroke-[3]" />
            </div>
          </div>
        </Link>

      </main>
    </div>
  );
}
