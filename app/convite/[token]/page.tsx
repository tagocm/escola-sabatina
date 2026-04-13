import { getInviteData } from "@/app/actions/classes";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import InviteSignUpForm from "@/components/ui/InviteSignUpForm";

interface Params {
  params: Promise<{ token: string }>;
}

export default async function ConvitePage({ params }: Params) {
  const { token } = await params;
  const invite = await getInviteData(token);

  if (!invite) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 selection:bg-foreground selection:text-white">
        <div className="w-full max-w-lg bg-white border-8 border-foreground p-12 shadow-editorial flex flex-col items-center text-center gap-8">
           <div className="w-24 h-24 bg-es-orange border-4 border-foreground flex items-center justify-center shadow-editorial-sm">
              <AlertTriangle className="w-12 h-12 stroke-[3]" />
           </div>
           <div className="flex flex-col gap-2 border-b-4 border-foreground pb-4">
              <h1 className="text-[40px] font-black uppercase tracking-tighter leading-none">INVITE FALHOU</h1>
              <p className="text-sm font-bold uppercase tracking-widest bg-es-yellow border-2 border-foreground px-2 py-0.5 mt-2 self-center">Link expirado ou inexistente</p>
           </div>
           <Link 
             href="/login" 
             className="w-full h-16 bg-foreground text-white font-black text-xl uppercase tracking-widest flex items-center justify-center hover:bg-foreground/90 transition-all shadow-editorial-sm"
           >
             Fazer Login
           </Link>
        </div>
      </div>
    );
  }

  // Tipagem manual para o retorno complexo do Supabase
  const inviteData = invite as unknown as {
    class_name: string;
    invited_by_full_name: string | null;
  };

  return (
    <div className="min-h-screen lg:flex selection:bg-foreground selection:text-white">
      {/* Editorial Panel */}
      <div className="hidden lg:flex w-1/2 bg-es-lilac border-r-8 border-foreground p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute -top-10 -left-10 w-64 h-64 bg-es-yellow border-4 border-foreground rotate-12" />
        <div className="absolute top-1/2 right-0 w-32 h-[120%] bg-es-orange border-l-8 border-foreground -translate-y-1/2" />
        
        <div className="relative z-10 text-foreground">
          <div className="inline-block bg-white border-4 border-foreground px-5 py-2 mb-8 shadow-editorial-sm">
            <h2 className="text-xl font-black uppercase tracking-widest">CONVITE ACEITO</h2>
          </div>
          <h1 className="text-[5vw] font-black leading-[0.9] tracking-tighter uppercase max-w-lg">
            VOCÊ FOI<br />
            CONVIDADO.
          </h1>
          <div className="mt-8 border-l-8 border-foreground pl-6">
            <p className="text-[1.5rem] font-bold uppercase tracking-tight leading-none italic opacity-60 mb-2">Junte-se à unidade:</p>
            <p className="text-[2.5rem] font-black uppercase leading-none underline decoration-foreground underline-offset-8">
              {inviteData.class_name}
            </p>
          </div>
        </div>

        <div className="relative z-10 max-w-sm bg-white border-4 border-foreground p-6 shadow-editorial-sm">
          <p className="text-lg font-black uppercase">Por: {inviteData.invited_by_full_name || "Escola Sabatina"}</p>
          <div className="h-1 bg-foreground w-full my-3" />
          <p className="text-xs font-bold uppercase text-foreground/60 leading-tight">
            Complete seus dados no formulário ao lado para começar sua jornada administrativa nesta unidade escolar.
          </p>
        </div>
      </div>

      {/* Registration Form */}
      <div className="w-full lg:w-1/2 bg-background flex flex-col items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-lg flex flex-col gap-8 py-8">
           <div className="flex flex-col gap-2 border-b-8 border-foreground pb-6">
              <h2 className="text-5xl font-black tracking-tighter uppercase leading-none">CRIAR CONTA</h2>
              <p className="text-sm font-bold uppercase tracking-widest bg-es-orange px-2 py-0.5 inline-block self-start border-2 border-foreground">
                Novos Professores
              </p>
           </div>

           <InviteSignUpForm token={token} />
           
           <p className="text-[10px] font-bold uppercase text-foreground/40 text-center tracking-widest">
             SISTEMA DE GESTÃO - ESCOLA SABATINA © 2026
           </p>
        </div>
      </div>
    </div>
  );
}
