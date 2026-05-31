"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { signInWithPassword } from "@/app/actions/auth";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { ButtonLoader } from "@/components/ui/AppLoader";
import Link from "next/link";

// Validações
const loginSchema = z.object({
  email: z.string().email({ message: "E-MAIL INVÁLIDO" }),
  password: z.string().min(6, { message: "MÍNIMO 6 CARACTERES" }),
});
type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: LoginFormValues) => {
    setErrorMsg(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("email", data.email);
      formData.append("password", data.password);
      
      const result = await signInWithPassword(formData);
      
      if (result?.error) {
        if (result.error.includes("Invalid login credentials")) {
          setErrorMsg("CREDENCIAIS INCORRETAS.");
        } else {
          setErrorMsg("FALHA AO ENTRAR.");
        }
      } else {
        router.push("/");
      }
    });
  };

  return (
    <div className="w-full max-w-md bg-surface border-[4px] border-foreground p-8 md:p-10 shadow-editorial flex flex-col gap-8">
      <div className="flex flex-col gap-3 border-b-4 border-foreground pb-6">
        <h2 className="text-4xl font-black tracking-tighter uppercase text-foreground leading-none">
          Entrar
        </h2>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] opacity-45">
          Acesse com seu e-mail e senha
        </p>
      </div>

      {errorMsg && (
        <div className="bg-es-orange border-[3px] border-foreground p-4 flex items-center gap-3 shadow-editorial-sm">
          <AlertTriangle className="w-6 h-6 text-foreground stroke-[2.5]" />
          <p className="text-sm font-bold uppercase">{errorMsg}</p>
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-black uppercase tracking-widest flex justify-between" htmlFor="email">
            <span>E-mail</span>
            {form.formState.errors.email && (
              <span className="text-es-orange">{form.formState.errors.email.message}</span>
            )}
          </label>
          <input
            {...form.register("email")}
            disabled={isPending}
            id="email"
            type="email"
            placeholder="COORDENADOR@ESCOLA.COM"
            className="w-full h-14 px-4 bg-surface border-[3px] border-foreground focus:outline-none focus:ring-0 focus:shadow-editorial-sm transition-shadow text-base font-bold placeholder:text-foreground/30 uppercase disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-end">
            <label className="text-sm font-black uppercase tracking-widest flex gap-2" htmlFor="password">
              <span>Senha</span>
              {form.formState.errors.password && (
                <span className="text-es-orange">{form.formState.errors.password.message}</span>
              )}
            </label>
          </div>
          <input
            {...form.register("password")}
            disabled={isPending}
            id="password"
            type="password"
            placeholder="••••••••"
            className="w-full h-14 px-4 bg-surface border-[3px] border-foreground focus:outline-none focus:ring-0 focus:shadow-editorial-sm transition-shadow text-base font-bold placeholder:text-foreground/30 uppercase disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full h-16 bg-es-lilac border-[4px] border-foreground text-foreground font-black text-xl uppercase tracking-widest flex items-center justify-between px-6 shadow-editorial hover:shadow-editorial-hover active:translate-y-1 active:translate-x-1 active:shadow-none transition-all disabled:opacity-70 disabled:cursor-not-allowed group cursor-pointer"
        >
          <span>{isPending ? "Processando" : "Acessar"}</span>
          {isPending ? (
            <ButtonLoader label="Processando login" />
          ) : (
            <ArrowRight className="w-8 h-8 group-active:translate-x-2 transition-transform stroke-[3]" />
          )}
        </button>
      </form>

      <div className="flex flex-col gap-4 pt-6 border-t-2 border-foreground">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-center opacity-40">
          Cadastro de responsável
        </p>
        <Link 
          href="/cadastro-responsavel" 
          className="w-full h-12 bg-surface border-[3px] border-foreground text-foreground font-black text-sm uppercase tracking-widest flex items-center justify-center shadow-editorial-sm hover:shadow-editorial-hover active:translate-y-0.5 active:translate-x-0.5 transition-all"
        >
          Sou Responsável
        </Link>
      </div>
    </div>
  );
}
