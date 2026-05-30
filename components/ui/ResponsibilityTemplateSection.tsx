"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import {
  alertClass,
  compactInputClass,
  fieldLabelClass,
  primaryActionWideClass,
} from "@/components/ui/design-system";
import { getResponsibilityColor } from "@/components/ui/responsibility-colors";

interface Template {
  id: string;
  name: string;
  participant_count: number;
  frequency_weeks: number;
  message_template: string;
  is_active?: boolean;
}

interface ResponsibilityTemplateSectionProps {
  templates: Template[];
  createAction: (formData: FormData) => Promise<{ error?: string; success?: boolean } | void>;
  deleteAction: (templateId: string) => Promise<{ error?: string; success?: boolean } | void>;
}

export default function ResponsibilityTemplateSection({
  templates,
  createAction,
  deleteAction,
}: ResponsibilityTemplateSectionProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await createAction(formData);
      if (result?.error) {
        setErrorMsg(result.error);
        return;
      }
      form.reset();
    });
  };

  const handleDelete = (templateId: string, name: string) => {
    const confirmed = window.confirm(`Remover a atividade ${name}?`);
    if (!confirmed) return;

    setErrorMsg(null);
    startTransition(async () => {
      const result = await deleteAction(templateId);
      if (result?.error) {
        setErrorMsg(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {errorMsg && (
        <div className={alertClass}>
          <AlertTriangle className="w-6 h-6 stroke-[3]" />
          <p className="text-[11px] font-black uppercase tracking-widest">{errorMsg}</p>
        </div>
      )}

      <form onSubmit={handleCreate} className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_140px_140px]">
        <div className="flex flex-col gap-2">
          <label className={fieldLabelClass} htmlFor="responsibility-name">Atividade</label>
          <input
            id="responsibility-name"
            name="name"
            type="text"
            required
            disabled={isPending}
            placeholder="Ex: Receber visitantes"
            className={compactInputClass}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className={fieldLabelClass} htmlFor="participant_count">Participantes</label>
          <input
            id="participant_count"
            name="participant_count"
            type="number"
            min={1}
            defaultValue={1}
            required
            disabled={isPending}
            className={compactInputClass}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className={fieldLabelClass} htmlFor="frequency_weeks">Periodicidade</label>
          <select
            id="frequency_weeks"
            name="frequency_weeks"
            defaultValue="1"
            disabled={isPending}
            className={`${compactInputClass} appearance-none`}
          >
            <option value="1">Todo sábado</option>
            <option value="2">A cada 2</option>
            <option value="3">A cada 3</option>
            <option value="4">A cada 4</option>
          </select>
        </div>

        <div className="flex flex-col gap-2 lg:col-span-3">
          <label className={fieldLabelClass} htmlFor="message_template">Mensagem padrão</label>
          <textarea
            id="message_template"
            name="message_template"
            required
            disabled={isPending}
            placeholder="Ex: Olá, [responsável]. Seu filho foi escalado para [atividade] no sábado [data]."
            className="min-h-[120px] bg-surface border-4 border-foreground px-4 py-3 font-bold text-sm uppercase tracking-wide outline-none"
          />
        </div>

        <div className="lg:col-span-3 flex justify-end">
          <button type="submit" disabled={isPending} className={primaryActionWideClass}>
            <span>{isPending ? "SALVANDO..." : "ADICIONAR ATIVIDADE"}</span>
            <Plus className="w-5 h-5 stroke-[3]" />
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-4">
        {templates.length > 0 ? (
          templates.map((template) => (
            <div
              key={template.id}
              className={`border-4 border-foreground ${getResponsibilityColor(template.id).card} p-4 shadow-editorial-sm flex flex-col gap-4`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <h4 className="text-lg font-black uppercase tracking-tight">{template.name}</h4>
                  <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em] opacity-50">
                    <span>{template.participant_count} participante(s)</span>
                    <span>A cada {template.frequency_weeks} sábado(s)</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(template.id, template.name)}
                  className="w-10 h-10 border-4 border-foreground bg-es-orange flex items-center justify-center shadow-editorial-sm"
                >
                  <Trash2 className="w-4 h-4 stroke-[3]" />
                </button>
              </div>
              <div className="border-2 border-foreground bg-surface px-4 py-3 text-[11px] font-bold uppercase tracking-widest leading-relaxed">
                {template.message_template}
              </div>
            </div>
          ))
        ) : (
          <div className="border-4 border-dashed border-foreground/30 bg-background px-6 py-10 text-center">
            <p className="text-lg font-black uppercase tracking-tight opacity-40">Nenhuma atividade cadastrada ainda</p>
          </div>
        )}
      </div>
    </div>
  );
}
