import Link from "next/link";
import { signOut } from "@/app/actions/auth";

export default function AccountUnderReviewPage() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-10 sm:px-6">
      <section
        aria-labelledby="review-title"
        aria-describedby="review-description"
        className="w-full max-w-3xl overflow-hidden border-[4px] border-foreground bg-surface shadow-editorial"
      >
        <div className="border-b-[4px] border-foreground bg-danger px-5 py-7 sm:px-10 sm:py-9">
          <div className="flex items-start gap-4 sm:gap-6">
            <div
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center border-[4px] border-foreground bg-foreground text-4xl font-black leading-none text-surface sm:h-20 sm:w-20 sm:text-6xl"
            >
              !
            </div>
            <div className="min-w-0">
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-foreground sm:text-xs">
                Atenção de segurança
              </p>
              <h1
                id="review-title"
                className="text-[clamp(2rem,8vw,4.6rem)] font-black uppercase leading-[0.9] tracking-[-0.06em] text-foreground"
              >
                Conta suspensa
                <br />
                para averiguação
              </h1>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 px-5 py-7 sm:px-10 sm:py-9">
          <div className="flex flex-col gap-3">
            <p className="text-xl font-black uppercase tracking-tight sm:text-2xl">
              Ana Paula Lopes
            </p>
            <p id="review-description" className="max-w-2xl text-base font-bold leading-relaxed sm:text-lg">
              O acesso desta conta foi temporariamente suspenso para uma conferência de segurança.
              Seus dados permanecem preservados durante a análise.
            </p>
          </div>

          <div className="border-[3px] border-foreground bg-surface-soft p-4 sm:p-5">
            <p className="text-[11px] font-black uppercase leading-relaxed tracking-[0.12em] sm:text-xs">
              Se você é a titular da conta, procure a coordenação da Escola Sabatina para confirmar sua identidade e solicitar a revisão do acesso.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <form action={signOut} className="w-full sm:w-auto">
              <button
                type="submit"
                className="flex min-h-12 w-full items-center justify-center border-[4px] border-foreground bg-foreground px-5 text-center text-sm font-black uppercase tracking-[0.16em] text-surface shadow-editorial-sm transition-all hover:bg-danger hover:text-foreground hover:shadow-editorial-hover active:translate-x-0.5 active:translate-y-0.5 sm:w-auto"
              >
                Sair do sistema
              </button>
            </form>
            <Link
              href="/login"
              className="flex min-h-12 w-full items-center justify-center border-[3px] border-foreground bg-surface px-5 text-center text-sm font-black uppercase tracking-[0.16em] shadow-editorial-sm transition-all hover:bg-es-yellow hover:shadow-editorial-hover active:translate-x-0.5 active:translate-y-0.5 sm:w-auto"
            >
              Voltar ao login
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
