"use client";

import { useState, useTransition } from "react";
import { signUpAsGuardian } from "@/app/actions/auth";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import {
  fieldLabelClass,
  primaryActionCenteredBlockClass,
  statusMessageClass,
  textInputClass,
} from "@/components/ui/design-system";

export default function GuardianSignUpForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [requiresEmailConfirmation, setRequiresEmailConfirmation] = useState(false);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    setRequiresEmailConfirmation(false);
    startTransition(async () => {
      const result = await signUpAsGuardian(formData);
      if (result.error) {
        setError(result.error);
      } else if (result.requiresEmailConfirmation) {
        setRequiresEmailConfirmation(true);
      } else {
        router.push("/responsavel");
      }
    });
  };

  if (requiresEmailConfirmation) {
    return (
      <div className="flex w-full max-w-md flex-col gap-5">
        <div className={`${statusMessageClass} border-es-green bg-green-100 text-green-800`}>
          Conta criada. Confirme seu e-mail para concluir o cadastro como responsável.
        </div>
        <Link href="/login" className={primaryActionCenteredBlockClass}>
          <span>Ir para o Login</span>
          <ArrowRight className="h-5 w-5 stroke-[3]" />
        </Link>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6 w-full max-w-md">
      <div className="flex flex-col gap-2">
        <label className={fieldLabelClass}>Nome Completo</label>
        <input
          name="fullName"
          type="text"
          required
          className={textInputClass}
          placeholder="Seu nome completo"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className={fieldLabelClass}>E-mail</label>
        <input
          name="email"
          type="email"
          required
          className={textInputClass}
          placeholder="seu@email.com"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className={fieldLabelClass}>Senha</label>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          maxLength={6}
          className={textInputClass}
          placeholder="Exatamente 6 caracteres"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className={fieldLabelClass}>WhatsApp (Opcional)</label>
        <input
          name="whatsapp"
          type="tel"
          className={textInputClass}
          placeholder="(11) 99999-9999"
        />
      </div>

      {error && (
        <div className={`${statusMessageClass} bg-red-100 border-red-500 text-red-700`}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className={primaryActionCenteredBlockClass}
      >
        <span>{isPending ? "Criando Conta..." : "Criar Conta de Responsável"}</span>
        <ArrowRight className="w-5 h-5 stroke-[3]" />
      </button>
    </form>
  );
}
