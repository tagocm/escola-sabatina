"use client";

import { useState, useTransition } from "react";
import { signUpAsGuardian } from "@/app/actions/auth";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
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

  const handleSubmit = (formData: FormData) => {
    setError(null);

    startTransition(async () => {
      const result = await signUpAsGuardian(formData);
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/responsavel");
      }
    });
  };

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
