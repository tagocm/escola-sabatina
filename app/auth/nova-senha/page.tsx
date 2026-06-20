"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, KeyRound } from "lucide-react";
import { updatePasswordAfterReset } from "@/app/actions/auth";
import { ButtonLoader } from "@/components/ui/AppLoader";

type FormMessage = {
  type: "success" | "error";
  text: string;
};

export default function NewPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<FormMessage | null>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updatePasswordAfterReset(formData);

      if (result?.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }

      setMessage({
        type: "success",
        text: "Senha atualizada. Entre novamente com a nova senha.",
      });
    });
  };

  return (
    <div className="w-full max-w-md bg-surface border-[4px] border-foreground p-8 md:p-10 shadow-editorial flex flex-col gap-8">
      <div className="flex flex-col gap-3 border-b-4 border-foreground pb-6">
        <div className="flex h-12 w-12 items-center justify-center border-[3px] border-foreground bg-es-yellow shadow-editorial-sm">
          <KeyRound className="h-6 w-6 stroke-[3]" />
        </div>
        <h2 className="text-4xl font-black tracking-tighter uppercase text-foreground leading-none">
          Nova senha
        </h2>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] opacity-45">
          Defina a senha de acesso
        </p>
      </div>

      {message && (
        <div
          className={`border-[3px] border-foreground p-4 flex items-center gap-3 shadow-editorial-sm ${
            message.type === "success" ? "bg-es-green" : "bg-es-orange"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-6 h-6 text-foreground stroke-[2.5]" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-foreground stroke-[2.5]" />
          )}
          <p className="text-sm font-bold uppercase">{message.text}</p>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-black uppercase tracking-widest" htmlFor="password">
            Senha
          </label>
          <input
            disabled={isPending || message?.type === "success"}
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            maxLength={6}
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="••••••"
            className="w-full h-14 px-4 bg-surface border-[3px] border-foreground focus:outline-none focus:ring-0 focus:shadow-editorial-sm transition-shadow text-base font-bold placeholder:text-foreground/30 disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-black uppercase tracking-widest" htmlFor="confirmPassword">
            Confirmar senha
          </label>
          <input
            disabled={isPending || message?.type === "success"}
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={6}
            maxLength={6}
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="••••••"
            className="w-full h-14 px-4 bg-surface border-[3px] border-foreground focus:outline-none focus:ring-0 focus:shadow-editorial-sm transition-shadow text-base font-bold placeholder:text-foreground/30 disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isPending || message?.type === "success"}
          className="w-full h-16 bg-es-lilac border-[4px] border-foreground text-foreground font-black text-base uppercase tracking-widest flex items-center justify-between px-6 shadow-editorial hover:shadow-editorial-hover active:translate-y-1 active:translate-x-1 active:shadow-none transition-all disabled:opacity-70 disabled:cursor-not-allowed group cursor-pointer"
        >
          <span>{isPending ? "Salvando" : "Salvar senha"}</span>
          {isPending ? (
            <ButtonLoader label="Salvando senha" />
          ) : (
            <ArrowRight className="w-7 h-7 group-active:translate-x-2 transition-transform stroke-[3]" />
          )}
        </button>
      </form>

      <Link
        href="/login"
        className="inline-flex h-12 items-center justify-center border-[3px] border-foreground bg-surface px-4 text-sm font-black uppercase tracking-widest shadow-editorial-sm hover:shadow-editorial-hover active:translate-y-0.5 active:translate-x-0.5 transition-all"
      >
        Entrar no app
      </Link>
    </div>
  );
}
