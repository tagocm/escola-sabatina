import { ButtonLoader } from "@/components/ui/AppLoader";

export default function AuthLoading() {
  return (
    <div className="w-full max-w-md border-4 border-foreground bg-surface p-8 shadow-editorial md:p-10">
      <div className="border-b-4 border-foreground pb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-45">Escola Sabatina</p>
        <h2 className="mt-2 text-4xl font-black uppercase leading-none tracking-tighter">Entrando</h2>
      </div>
      <div className="mt-8 flex h-16 items-center justify-between border-4 border-foreground bg-es-lilac px-6 text-xl font-black uppercase tracking-widest shadow-editorial-sm">
        Processando
        <ButtonLoader label="Carregando autenticação" />
      </div>
    </div>
  );
}
