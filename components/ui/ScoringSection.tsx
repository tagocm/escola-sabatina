"use client";

import { useTransition, useState } from "react";
import { Plus, Layers, Trash2, Edit2, Sparkles, ArrowUp, ArrowDown } from "lucide-react";
import { deleteScoringRule, loadDefaultRulesAction, updateScoringRuleOrder } from "@/app/actions/scoring";
import { ButtonLoader } from "@/components/ui/AppLoader";
import ScoringRuleForm from "./ScoringRuleForm";

interface Rule {
  id: string;
  name: string;
  category: "frequencia" | "participacao" | "espiritual" | "atividade";
  points: number;
  is_active: boolean;
  display_order: number;
}

interface ScoringSectionProps {
  classId: string;
  rules: Rule[];
}

const CATEGORY_STYLES = {
  frequencia: { color: "bg-es-blue", label: "Frequência" },
  participacao: { color: "bg-es-orange", label: "Participação" },
  espiritual: { color: "bg-es-lilac", label: "Espiritual" },
  atividade: { color: "bg-es-yellow", label: "Atividade" },
};

export default function ScoringSection({ classId, rules }: ScoringSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [isAdding, setIsAdding] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  const closeEditor = () => {
    setIsAdding(false);
    setEditingRule(null);
  };

  const openRuleEditor = (rule: Rule) => {
    setIsAdding(false);
    setEditingRule(rule);
  };

  const handleLoadDefaults = () => {
    if (confirm("Deseja carregar os itens de avaliação padrão? Isso adicionará as 8 regras base à sua classe.")) {
      startTransition(async () => {
        await loadDefaultRulesAction(classId);
      });
    }
  };

  const handleDelete = (ruleId: string) => {
    if (confirm("Tem certeza que deseja excluir este item?")) {
      startTransition(async () => {
        await deleteScoringRule(classId, ruleId);
      });
    }
  };

  const handleReorder = (ruleId: string, direction: "up" | "down") => {
    startTransition(async () => {
      await updateScoringRuleOrder(classId, ruleId, direction);
    });
  };

  return (
    <div className="flex flex-col gap-8 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-8 border-foreground pb-4">
        <div>
           <h2 className="text-[32px] font-black uppercase tracking-tighter leading-none">Itens de Avaliação na Chegada</h2>
           <p className="text-xs font-bold uppercase tracking-widest mt-2 opacity-50">Configuração de Pontuação da Unidade</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleLoadDefaults}
            disabled={isPending}
            className="h-12 px-5 bg-es-lilac border-4 border-foreground text-foreground font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-editorial-sm hover:shadow-editorial active:translate-y-1 transition-all disabled:opacity-50"
          >
            {isPending ? <ButtonLoader size="sm" label="Carregando itens padrão" /> : <Sparkles className="w-4 h-4" />}
            Itens Padrão
          </button>
          <button
            onClick={() => setIsAdding(true)}
            className="h-12 px-5 bg-es-green border-4 border-foreground text-foreground font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-editorial-sm hover:shadow-editorial active:translate-y-1 transition-all"
          >
            <Plus className="w-5 h-5 stroke-[3]" />
            Novo Item
          </button>
        </div>
      </div>

      {(isAdding || editingRule) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/25 p-3 backdrop-blur-[2px] md:items-center md:p-6">
          <div
            className="absolute inset-0"
            aria-hidden="true"
            onClick={closeEditor}
          />
          <div className="relative z-10 max-h-[calc(100svh-1.5rem)] w-full max-w-2xl overflow-y-auto border-4 border-foreground bg-surface-warm p-5 shadow-editorial animate-in zoom-in-95 duration-200 md:max-h-[85svh] md:p-6">
            <ScoringRuleForm
              classId={classId}
              initialData={editingRule || undefined}
              onClose={closeEditor}
            />
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <div className="w-full bg-surface border-4 border-foreground p-12 flex flex-col items-center justify-center text-center gap-4 shadow-editorial-sm">
           <Layers className="w-16 h-16 opacity-10" />
           <p className="text-sm font-black uppercase tracking-widest opacity-40">Nenhum item definido para esta unidade.</p>
           <button onClick={() => setIsAdding(true)} className="text-es-orange font-black uppercase underline underline-offset-4">Criar primeiro item agora</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {rules.map((rule, index) => {
            const style = CATEGORY_STYLES[rule.category as keyof typeof CATEGORY_STYLES];
            return (
              <div 
                key={rule.id}
                role="button"
                tabIndex={0}
                onClick={() => openRuleEditor(rule)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openRuleEditor(rule);
                  }
                }}
                className={`group bg-surface border-4 border-foreground shadow-editorial flex flex-col transition-all overflow-hidden cursor-pointer focus:outline-none focus:shadow-editorial-hover ${!rule.is_active ? "opacity-60 grayscale" : "hover:shadow-editorial-hover active:translate-y-0.5"}`}
              >
                <div className={`h-2 w-full ${style.color} border-b-4 border-foreground`} />
                <div className="p-5 flex-1 flex flex-col gap-4">
                   <div className="flex items-start justify-between min-h-[32px]">
                     <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-2 border-foreground ${style.color}`}>
                          {style.label}
                        </span>
                        <div className="flex items-center gap-1">
                           <button 
                             onClick={(event) => {
                               event.stopPropagation();
                               handleReorder(rule.id, "up");
                             }} 
                             disabled={index === 0 || isPending}
                             className="p-1 hover:bg-background border border-transparent hover:border-foreground disabled:opacity-30"
                           >
                              {isPending ? <ButtonLoader size="sm" label="Ordenando item" /> : <ArrowUp className="w-3 h-3" />}
                           </button>
                           <button 
                             onClick={(event) => {
                               event.stopPropagation();
                               handleReorder(rule.id, "down");
                             }} 
                             disabled={index === rules.length - 1 || isPending}
                             className="p-1 hover:bg-background border border-transparent hover:border-foreground disabled:opacity-30"
                           >
                              {isPending ? <ButtonLoader size="sm" label="Ordenando item" /> : <ArrowDown className="w-3 h-3" />}
                           </button>
                        </div>
                     </div>
                     <div className="flex items-center gap-2 text-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button
                          onClick={(event) => {
                            event.stopPropagation();
                            openRuleEditor(rule);
                          }}
                          className="p-1 hover:bg-es-yellow transition-colors border-2 border-transparent hover:border-foreground"
                       >
                          <Edit2 className="w-4 h-4 text-foreground stroke-[2.5]" />
                       </button>
                       <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDelete(rule.id);
                          }}
                          disabled={isPending}
                          className="p-1 hover:bg-es-orange transition-colors border-2 border-transparent hover:border-foreground"
                       >
                          {isPending ? <ButtonLoader size="sm" label="Excluindo item" /> : <Trash2 className="w-4 h-4 text-foreground stroke-[2.5]" />}
                       </button>
                     </div>
                   </div>
                   
                   <div className="flex flex-col gap-1">
                      <h4 className="text-xl font-black uppercase leading-tight line-clamp-2">{rule.name}</h4>
                   </div>

                   <div className="mt-auto pt-4 flex items-end justify-between border-t-2 border-foreground/10">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-foreground/40 italic tracking-widest">Valor</span>
                        <span className="text-[28px] font-black leading-none">{rule.points}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest bg-foreground text-surface px-2 py-0.5">pts</span>
                      </div>
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
