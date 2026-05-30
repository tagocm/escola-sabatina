"use client";

import { useTransition, useState } from "react";
import { ArrowRight, AlertTriangle, Loader2, X } from "lucide-react";
import { upsertScoringRule } from "@/app/actions/scoring";
import {
  alertClass,
  compactInputClass,
  fieldLabelClass,
  primaryActionBlockClass,
} from "@/components/ui/design-system";

interface RuleFormProps {
  classId: string;
  initialData?: {
    id: string;
    name: string;
    category: string;
    points: number;
    display_order: number;
    is_active: boolean;
  };
  onClose: () => void;
}

const CATEGORIES = [
  { id: "frequencia", label: "Frequência", color: "bg-es-blue" },
  { id: "participacao", label: "Participação", color: "bg-es-orange" },
  { id: "espiritual", label: "Espiritual", color: "bg-es-lilac" },
  { id: "atividade", label: "Atividade", color: "bg-es-yellow" },
];

export default function ScoringRuleForm({ classId, initialData, onClose }: RuleFormProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const formData = new FormData(e.currentTarget);
    formData.append("isActive", "true"); // Always active on create/edit from this simple form

    startTransition(async () => {
      const result = await upsertScoringRule(classId, initialData?.id, formData);
      if (result?.error) {
        setErrorMsg(result.error);
      } else {
        onClose();
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 animate-in slide-in-from-top-4 duration-200">
      <div className="flex items-center justify-between border-b-4 border-foreground pb-2">
         <h3 className="text-xl font-black uppercase tracking-tighter">
           {initialData ? "Editar Regra" : "Nova Regra"}
         </h3>
         <button onClick={onClose} className="p-1 hover:bg-foreground hover:text-surface transition-colors">
            <X className="w-6 h-6 stroke-[3]" />
         </button>
      </div>

      {errorMsg && (
        <div className={alertClass}>
          <AlertTriangle className="w-5 h-5 stroke-[4]" />
          <p className="text-[11px] font-black uppercase tracking-widest">{errorMsg}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label className={fieldLabelClass}>Nome da Regra</label>
          <input 
            name="name" 
            defaultValue={initialData?.name} 
            required 
            placeholder="EX: PARTICIPAÇÃO ESPECIAL"
            className={compactInputClass} 
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div className="flex flex-col gap-1">
              <label className={fieldLabelClass}>Categoria</label>
              <select 
                name="category" 
                defaultValue={initialData?.category || "participacao"}
                className={`${compactInputClass} appearance-none font-black`}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
           </div>
           <div className="flex flex-col gap-1">
              <label className={fieldLabelClass}>Pontos</label>
              <input 
                name="points" 
                type="number" 
                defaultValue={initialData?.points || 1} 
                required 
                className={`${compactInputClass} font-black`} 
              />
           </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className={primaryActionBlockClass}
        >
          <span>{isPending ? "SALVANDO..." : "SALVAR REGRA"}</span>
          {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform stroke-[3]" />}
        </button>
      </form>
    </div>
  );
}
