"use client";

import { useTransition, useState } from "react";
import { ArrowRight, AlertTriangle, Loader2 } from "lucide-react";
import { signUpWithInvite } from "@/app/actions/auth";
import {
  alertClass,
  compactInputClass,
  fieldLabelClass,
  primaryActionBlockClass,
} from "@/components/ui/design-system";

export default function InviteSignUpForm({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const formData = new FormData(e.currentTarget);
    
    startTransition(async () => {
      const result = await signUpWithInvite(formData, token);
      if (result?.error) {
        setErrorMsg(result.error);
      } else {
        window.location.href = "/";
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {errorMsg && (
        <div className={alertClass}>
          <AlertTriangle className="w-6 h-6 stroke-[3]" />
          <p className="text-[11px] font-black uppercase tracking-widest">{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className={fieldLabelClass}>Nome Completo</label>
          <input name="fullName" type="text" required placeholder="SEU NOME" className={compactInputClass} />
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className={fieldLabelClass}>E-mail</label>
          <input name="email" type="email" required placeholder="EMAIL@EXEMPLO.COM" className={compactInputClass} />
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className={fieldLabelClass}>Senha</label>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            maxLength={6}
            placeholder="Exatamente 6 caracteres"
            className={compactInputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={fieldLabelClass}>Sexo</label>
          <select name="sex" defaultValue="masculino" required className={`${compactInputClass} appearance-none`}>
            <option value="masculino">Masculino</option>
            <option value="feminino">Feminino</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={fieldLabelClass}>WhatsApp</label>
          <input name="whatsapp" type="text" required placeholder="(00) 00000-0000" className={compactInputClass} />
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className={fieldLabelClass}>Data de Nascimento</label>
          <input name="birthDate" type="date" required className={compactInputClass} />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className={`${primaryActionBlockClass} mt-2`}
      >
        <span>{isPending ? "PROCESSANDO..." : "Finalizar Cadastro"}</span>
        {isPending ? (
          <Loader2 className="w-5 h-5 animate-spin stroke-[3]" />
        ) : (
          <ArrowRight className="w-6 h-6 group-active:translate-x-1 transition-transform stroke-[3]" />
        )}
      </button>
    </form>
  );
}
