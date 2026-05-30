"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { LogOut, User, ChevronDown, Repeat, Check, Plus } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { updateLastClass } from "@/app/actions/classes";

interface ClassItem {
  id: string;
  name: string;
}

interface UserDropdownProps {
  user: {
    fullName: string;
    email: string;
  };
  classes: ClassItem[];
  currentClassId: string | null;
  canManageClasses?: boolean;
  compact?: boolean;
}

export default function UserDropdown({
  user,
  classes,
  currentClassId,
  canManageClasses = true,
  compact = false,
}: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 256 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const currentClass = classes.find((c) => c.id === currentClassId);

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportWidth = window.innerWidth;
      const desiredWidth = Math.min(320, viewportWidth - 24);
      const left = Math.min(
        Math.max(12, rect.right - desiredWidth),
        Math.max(12, viewportWidth - desiredWidth - 12),
      );

      setMenuPosition({
        top: rect.bottom + 12,
        left,
        width: desiredWidth,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  const handleSwitchClass = async (classId: string) => {
    await updateLastClass(classId);
    setIsOpen(false);
    window.location.reload(); // Refresh to update context
  };

  return (
    <div className="relative z-[70]">
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`relative z-[71] flex w-full max-w-full items-center justify-between gap-3 border-2 border-foreground bg-surface shadow-editorial-sm transition-all cursor-pointer group hover:shadow-editorial-hover active:translate-y-0.5 active:translate-x-0.5 ${
          compact ? "min-h-11 px-4" : "px-3 py-2"
        }`}
      >
        {compact ? (
          <span className="truncate text-[10px] font-black uppercase tracking-widest text-foreground/40">
            {user.fullName || "DIRETOR(A)"}
          </span>
        ) : (
          <div className="flex min-w-0 flex-col items-start gap-0.5 leading-none">
            <span className="truncate text-[10px] font-black uppercase tracking-widest text-foreground/40">
              {user.fullName || "DIRETOR(A)"}
            </span>
            {currentClass && (
              <div className="flex min-w-0 items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-es-orange border border-foreground" />
                <span className="truncate text-[11px] font-black uppercase tracking-tight text-foreground">
                  {currentClass.name}
                </span>
              </div>
            )}
          </div>
        )}
        <ChevronDown className={`w-4 h-4 stroke-[3] opacity-40 group-hover:opacity-100 transition-all ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && typeof document !== "undefined" && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[68] bg-transparent" 
            onClick={() => setIsOpen(false)}
          />
          <div
            className="fixed z-[72] flex max-h-[calc(100vh-32px)] flex-col overflow-hidden border-4 border-foreground bg-surface shadow-editorial animate-in fade-in zoom-in-95 duration-100"
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
            }}
          >
            {canManageClasses && (
              <div className="p-4 bg-background border-b-4 border-foreground">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-foreground/40">CONTRAPARTE ATUAL</p>
                  <Link
                    href="/classes/nova"
                    className="flex h-8 w-8 items-center justify-center border-2 border-foreground bg-surface shadow-editorial-sm transition-all hover:bg-es-lilac hover:shadow-editorial-hover active:translate-x-0.5 active:translate-y-0.5"
                    title="Criar nova classe"
                    aria-label="Criar nova classe"
                    onClick={() => setIsOpen(false)}
                  >
                    <Plus className="h-4 w-4 stroke-[2.8]" />
                  </Link>
                </div>
                {currentClass ? (
                  <div className="flex items-center justify-between bg-es-orange/10 border-2 border-es-orange p-3">
                    <span className="font-black text-xs uppercase">{currentClass.name}</span>
                    <Check className="w-4 h-4 text-es-orange stroke-[3]" />
                  </div>
                ) : (
                  <p className="text-xs font-bold uppercase text-foreground/40 italic">Nenhuma classe selecionada</p>
                )}
              </div>
            )}

            {/* Trocar de Classe */}
            {canManageClasses && classes.length > 1 && (
              <div className="max-h-48 overflow-y-auto border-b-4 border-foreground bg-surface p-2">
                <p className="px-2 pt-2 pb-1 text-[9px] font-black uppercase tracking-widest text-foreground/40">Trocar de Classe</p>
                {classes.filter(c => c.id !== currentClassId).map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => handleSwitchClass(cls.id)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-es-yellow border-2 border-transparent hover:border-foreground transition-all cursor-pointer group/item"
                  >
                    <Repeat className="w-3.5 h-3.5 text-foreground/40 group-hover/item:text-foreground" />
                    <span className="font-bold text-[11px] uppercase text-left leading-tight">{cls.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Ações */}
            <div className="flex flex-col">
              <Link
                href="/perfil"
                className="flex items-center gap-3 p-4 hover:bg-es-lilac border-b-4 border-foreground transition-all font-black text-xs uppercase tracking-widest group/action"
                onClick={() => setIsOpen(false)}
              >
                <User className="w-4 h-4 group-hover/action:scale-110 transition-transform stroke-[2.5]" />
                Meu Perfil
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-3 p-4 hover:bg-danger hover:text-surface transition-all font-black text-xs uppercase tracking-widest group/action text-left cursor-pointer"
                >
                  <LogOut className="w-4 h-4 group-hover/action:rotate-12 transition-transform stroke-[2.5]" />
                  Sair do Sistema
                </button>
              </form>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
