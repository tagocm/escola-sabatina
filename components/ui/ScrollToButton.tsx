"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

interface ScrollToButtonProps {
  targetId: string;
  label: string;
  variant?: "up" | "down";
  count?: number;
}

export default function ScrollToButton({ targetId, label, variant = "down", count }: ScrollToButtonProps) {
  const handleScroll = () => {
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <button
      onClick={handleScroll}
      className={`
        flex items-center gap-2 px-3 py-1.5 border-4 border-foreground shadow-editorial-sm 
        hover:shadow-editorial-hover active:translate-y-0.5 active:translate-x-0.5 transition-all
        text-[10px] font-black uppercase tracking-widest
        ${variant === "down" ? "bg-es-blue" : "bg-es-yellow"}
      `}
    >
      {variant === "up" && <ChevronUp className="w-3 h-3 stroke-[4]" />}
      {label} {count !== undefined && `(${count})`}
      {variant === "down" && <ChevronDown className="w-3 h-3 stroke-[4]" />}
    </button>
  );
}
