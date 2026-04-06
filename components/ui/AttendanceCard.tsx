"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { saveStudentAttendanceRecord } from "@/app/actions/attendance";
import { UserCircle, Loader2, Check, Save, Lock, Settings } from "lucide-react";
import { getStudentPhotoSrc } from "@/lib/storage/student-photos";

interface Rule {
  id: string;
  name: string;
  category: "frequencia" | "participacao" | "espiritual" | "atividade";
  points: number;
}

interface AttendanceCardProps {
  classId: string;
  date: string;
  student: {
    id: string;
    full_name: string;
    photo_url: string | null;
  };
  rules: Rule[];
  initialSelectedRuleIds: string[];
  isSaved?: boolean;
}

const CATEGORY_STYLES = {
  frequencia: { color: "bg-es-blue", border: "border-es-blue" },
  participacao: { color: "bg-es-orange", border: "border-es-orange" },
  espiritual: { color: "bg-es-lilac", border: "border-es-lilac" },
  atividade: { color: "bg-es-yellow", border: "border-es-yellow" },
};

export default function AttendanceCard({ 
  classId, 
  date, 
  student, 
  rules, 
  initialSelectedRuleIds,
  isSaved = false
}: AttendanceCardProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedRuleIds);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Helper to simplify names
  const getShortName = (name: string) => {
    if (name.includes("Participação")) {
       const action = name.replace("Participação ", "");
       if (action.includes("recolher")) return "Oferta";
       if (action.includes("cantar")) return "Cantar";
       if (action.includes("carta")) return "Carta";
       return action;
    }
    if (name.includes("Atividade")) return "Atividade";
    if (name.includes("Verso")) return "Verso";
    return name;
  }

  const getFormattedName = (fullName: string) => {
    const parts = fullName.split(" ");
    return {
      first: parts[0].toUpperCase(),
      last: parts.length > 1 ? parts[parts.length - 1].toUpperCase() : ""
    };
  }

  const handleToggle = (ruleId: string) => {
    if (isSaved && !isEditing) return;
    
    setSelectedIds(current => 
      current.includes(ruleId) 
        ? current.filter(id => id !== ruleId) 
        : [...current, ruleId]
    );
  };

  const handleSave = () => {
    setSaveError(null);
    startTransition(async () => {
      const result = await saveStudentAttendanceRecord(
        classId,
        date,
        student.id,
        selectedIds,
        rules.map(r => ({ id: r.id, points: r.points }))
      );

      if (result.error) {
        setSaveError(result.error);
      } else {
        setIsEditing(false);
      }
    });
  };

  const totalPoints = rules
    .filter(r => selectedIds.includes(r.id))
    .reduce((sum, r) => sum + r.points, 0);

  const nameObj = getFormattedName(student.full_name);
  const canInteract = !isSaved || isEditing;
  const photoSrc = getStudentPhotoSrc(student.id, student.photo_url);

  return (
    <div className={`
      bg-white border-4 border-foreground shadow-editorial p-4 md:p-6 flex flex-col xl:grid xl:grid-cols-[140px_1fr_auto] gap-5 md:gap-6 transition-all 
      ${isSaved && !isEditing ? "opacity-60 grayscale bg-background/50 border-foreground/10" : "border-foreground"}
    `}>
      
       {/* Polaroid Student Profile (Unified Standard) */}
       <div className="flex flex-col shrink-0 items-center lg:items-start group/card">
          <div className="bg-white border-4 border-foreground shadow-editorial-sm p-1.5 pb-5 flex flex-col gap-2 transition-all group-hover/card:shadow-editorial group-active/card:translate-y-0.5">
             <div className="relative flex h-[104px] w-[104px] items-center justify-center overflow-hidden border-4 border-foreground bg-background md:h-[120px] md:w-[120px]">
                {photoSrc ? (
                  <Image
                    src={photoSrc}
                    alt={student.full_name}
                    fill
                    unoptimized
                    sizes="120px"
                    className={`object-cover transition-all ${isSaved && !isEditing ? "grayscale" : ""}`}
                  />
                ) : (
                  <UserCircle className="w-14 h-14 opacity-10" />
                )}
                {isSaved && !isEditing && (
                  <div className="absolute inset-0 bg-es-green/10 flex items-center justify-center">
                    <Lock className="w-6 h-6 text-es-green opacity-50" />
                  </div>
                )}
             </div>
             <div className="flex flex-col items-center justify-center py-1 px-1 leading-[0.8] overflow-hidden">
                <span className="text-[14px] font-black uppercase tracking-tighter text-foreground text-center truncate w-full">
                  {nameObj.first}
                </span>
                {nameObj.last && (
                  <span className="text-[11px] font-bold uppercase tracking-tighter text-foreground/40 text-center truncate w-full mt-0.5">
                    {nameObj.last}
                  </span>
                )}
             </div>
          </div>
       </div>

       {/* Scoring Grid (Compact) */}
       <div className={`flex flex-row flex-wrap gap-2.5 items-center content-center ${!canInteract ? "pointer-events-none" : ""}`}>
         {rules.map((rule) => {
           const isSelected = selectedIds.includes(rule.id);
           const style = CATEGORY_STYLES[rule.category as keyof typeof CATEGORY_STYLES];
           const shortName = getShortName(rule.name);

           return (
             <button
               key={rule.id}
               onClick={() => handleToggle(rule.id)}
               disabled={isPending || (!canInteract)}
               className={`
                 relative min-h-12 min-w-[92px] px-3 flex flex-1 basis-[calc(50%-0.5rem)] flex-col items-start justify-center border-4 border-foreground transition-all select-none sm:flex-none
                 ${isSelected ? `${style.color} shadow-editorial-sm translate-y-0.5` : "bg-white hover:bg-background shadow-none"}
                 ${canInteract ? "cursor-pointer" : "cursor-default opacity-50"}
               `}
             >
                <div className="flex flex-col items-start w-full text-left">
                  <span className="text-[11px] font-black uppercase tracking-tight leading-none truncate w-full">
                    {shortName}
                  </span>
                  <span className={`text-[9px] font-bold uppercase tracking-widest leading-none mt-1.5 ${isSelected ? "text-foreground" : "opacity-30"}`}>
                    {rule.points} {rule.points === 1 ? "PT" : "PTS"}
                  </span>
                </div>

                {isSelected && (
                  <div className="absolute top-1 right-1">
                    <Check className="w-3 h-3 text-foreground stroke-[4px]" />
                  </div>
                )}
             </button>
           );
         })}
       </div>

       {/* Actions / Totalizer (Standardized Right Side) */}
       <div className="flex flex-row items-center justify-between gap-4 border-t-4 border-foreground/5 pt-4 xl:flex-col xl:items-end xl:justify-center xl:border-l-4 xl:border-t-0 xl:pl-8 xl:pt-0">
          <div className="flex flex-col items-center relative order-1 lg:order-none">
            {isSaved && !isEditing && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-es-green text-white text-[8px] font-black px-2 py-0.5 shadow-editorial-sm whitespace-nowrap z-10 border-2 border-foreground uppercase tracking-widest">
                Salvo
              </span>
            )}
            <div className={`
              w-16 h-16 border-4 border-foreground rounded-none flex flex-col items-center justify-center shrink-0 transition-all font-black
              ${isSaved && !isEditing ? "bg-es-green shadow-none grayscale-0" : "bg-es-yellow shadow-editorial-sm"}
            `}>
               <span className="text-xl leading-none">{totalPoints}</span>
               <span className="text-[8px] uppercase tracking-widest mt-1 opacity-50">Pts</span>
            </div>
          </div>

          <div className="order-2 flex min-w-[148px] flex-col gap-2 xl:w-full">
            {isSaved && !isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-white hover:bg-background border-4 border-foreground py-2.5 px-4 shadow-editorial-sm hover:translate-y-0.5 active:translate-y-1 transition-all flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[9px]"
              >
                <Settings className="w-3.5 h-3.5" />
                Editar
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={isPending}
                className={`
                  border-4 border-foreground py-3 px-4 shadow-editorial-sm hover:translate-y-0.5 active:translate-y-1 transition-all flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[11px] disabled:opacity-50 disabled:cursor-wait
                  ${isSaved ? "bg-es-blue" : "bg-es-blue"}
                `}
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaved ? "Atualizar" : "Salvar"}
              </button>
            )}
            
            {isEditing && (
              <button 
                onClick={() => setIsEditing(false)}
                className="text-[9px] font-black uppercase tracking-widest text-center py-1 opacity-40 hover:opacity-100 transition-opacity"
              >
                Cancelar
              </button>
            )}

            {saveError && <p className="text-[9px] font-bold text-red-500 uppercase max-w-[150px] leading-tight text-center">{saveError}</p>}
          </div>
       </div>

    </div>
  );
}
