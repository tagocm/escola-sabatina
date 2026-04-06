"use client";

import { useTransition, useState } from "react";
import { updateProfile } from "@/app/actions/auth";
import { UserCircle, ArrowRight, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import PolaroidPhoto from "@/components/ui/PolaroidPhoto";
import {
  compactInputClass,
  fieldLabelAccentClass,
  fieldLabelClass,
  fieldLabelMutedClass,
  mutedInputClass,
  primaryActionWideClass,
  readonlyInputClass,
  textInputClass,
} from "@/components/ui/design-system";

interface ProfileFormProps {
  profile: {
    full_name: string | null;
    sex: string | null;
    birth_date: string | null;
    whatsapp: string | null;
    email?: string;
  };
}

export default function ProfileForm({ profile }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    const formData = new FormData(e.currentTarget);
    
    startTransition(async () => {
      const result = await updateProfile(formData);
      if (result?.error) {
        setErrorMsg(result.error);
      } else {
        setSuccessMsg("Perfil atualizado com sucesso!");
        // Clear message after 3s
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Notifications Slot */}
      {(successMsg || errorMsg) && (
        <div className={`p-4 border-4 border-foreground shadow-editorial-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${successMsg ? 'bg-es-lilac/20' : 'bg-es-orange'}`}>
          {successMsg ? (
            <>
              <CheckCircle2 className="w-6 h-6 stroke-[3]" />
              <p className="text-xs font-black uppercase tracking-widest">{successMsg}</p>
            </>
          ) : (
            <>
              <AlertTriangle className="w-6 h-6 stroke-[3]" />
              <p className="text-xs font-black uppercase tracking-widest">{errorMsg}</p>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-10 gap-y-6 xl:grid-cols-[256px_1fr] md:gap-y-8">
        {/* Left Column - Shared Polaroid */}
        <div className="flex flex-col items-center lg:items-start">
          <PolaroidPhoto
            disabled
            emptyState={<UserCircle className="w-32 h-32 text-foreground/10 stroke-[1]" />}
            emptyLabel="Foto em Breve"
            footerLabel={profile.full_name?.split(" ")[0] || "PERFIL"}
          />
        </div>

        {/* Right Column - Fields */}
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 md:gap-x-8 md:gap-y-5">
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className={fieldLabelClass}>Nome Completo</label>
              <input
                name="fullName"
                required
                disabled={isPending}
                defaultValue={profile.full_name || ""}
                className={textInputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className={fieldLabelMutedClass}>E-mail (Inalterável)</label>
              <input
                disabled
                defaultValue={profile.email || ""}
                className={readonlyInputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className={fieldLabelClass}>Sexo</label>
              <select
                name="sex"
                defaultValue={profile.sex || ""}
                required
                disabled={isPending}
                className={`${compactInputClass} appearance-none`}
              >
                <option value="" disabled>Selecionar</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className={fieldLabelAccentClass}>Data de Nascimento</label>
              <input
                name="birthDate"
                type="date"
                required
                disabled={isPending}
                defaultValue={profile.birth_date || ""}
                className={compactInputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className={fieldLabelAccentClass}>WhatsApp</label>
              <input
                name="whatsapp"
                required
                disabled={isPending}
                defaultValue={profile.whatsapp || ""}
                placeholder="(00) 00000-0000"
                className={mutedInputClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
             <div className="hidden sm:block sm:w-1/3" />
             <button
              type="submit"
              disabled={isPending}
              className={primaryActionWideClass}
            >
              <span>{isPending ? "SALVANDO..." : "SALVAR ALTERAÇÕES"}</span>
              {isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ArrowRight className="w-6 h-6 group-active:translate-x-1 transition-transform stroke-[3]" />
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
