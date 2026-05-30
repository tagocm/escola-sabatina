import GuardianSignUpForm from "@/components/ui/GuardianSignUpForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function CadastroResponsavelPage() {
  return (
    <div className="w-full max-w-md bg-surface border-[4px] border-foreground p-8 md:p-10 shadow-editorial transition-all flex flex-col gap-8">
      <div className="flex flex-col gap-1 border-b-4 border-foreground pb-6">
        <Link 
          href="/login" 
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity mb-2"
        >
          <ArrowLeft className="w-3 h-3" /> Voltar ao Login
        </Link>
        <h2 className="text-3xl font-black tracking-tighter uppercase text-foreground">
          Cadastro de Responsável
        </h2>
        <p className="text-[10px] font-bold text-foreground uppercase tracking-widest bg-es-orange px-2 inline-block self-start border-2 border-foreground shadow-editorial-sm">
          Acesso para Pais e Tutores
        </p>
      </div>

      <GuardianSignUpForm />

      <div className="pt-4 border-t-2 border-foreground border-dashed">
        <p className="text-[10px] font-bold uppercase tracking-widest text-center opacity-40">
          Já tem conta? <Link href="/login" className="underline hover:text-es-orange transition-colors">Entrar aqui</Link>
        </p>
      </div>
    </div>
  );
}
