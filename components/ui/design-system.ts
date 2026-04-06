export const pageShellClass =
  "flex min-h-screen flex-col items-center justify-start gap-4 overflow-x-hidden bg-background px-3 pb-20 pt-4 md:gap-8 md:px-6 lg:px-8 selection:bg-foreground selection:text-white";

export const pageMainClass =
  "relative z-10 flex w-full max-w-6xl flex-col gap-6 md:gap-8";

export const stackedPageClass = "flex flex-col gap-6 md:gap-8";

export const surfaceClass = "bg-white border-4 border-foreground shadow-editorial";

export const surfaceSoftClass = "bg-white border-4 border-foreground shadow-editorial-sm";

export const emptyStateClass =
  "w-full bg-white border-4 border-foreground px-6 py-10 md:p-16 flex flex-col items-center justify-center text-center gap-5 md:gap-6 shadow-editorial";

export const gridCardClass =
  "group bg-white border-4 border-foreground shadow-editorial-sm flex flex-col overflow-hidden transition-all hover:shadow-editorial hover:translate-y-0.5 active:translate-y-1";

export const listCardClass =
  "bg-white border-4 border-foreground shadow-editorial-sm p-4 md:p-6 flex flex-col md:flex-row md:items-center gap-4";

export const fieldLabelClass =
  "text-[10px] md:text-[11px] font-black uppercase tracking-[0.16em] leading-none";

export const fieldLabelAccentClass = `${fieldLabelClass} text-es-lilac`;

export const fieldLabelMutedClass = `${fieldLabelClass} opacity-40 italic`;

export const textInputClass =
  "w-full h-12 px-4 bg-white border-4 border-foreground text-foreground font-black uppercase tracking-[0.08em] outline-none focus:shadow-editorial-sm transition-all text-base md:h-11 md:text-sm";

export const compactInputClass =
  "w-full h-12 px-4 bg-white border-4 border-foreground text-foreground font-bold uppercase outline-none focus:bg-es-lilac/10 transition-colors text-base md:h-10 md:text-sm";

export const mutedInputClass =
  "w-full h-12 px-4 bg-background border-4 border-foreground text-foreground font-bold uppercase outline-none text-base md:h-10 md:text-sm";

export const readonlyInputClass =
  "w-full h-12 px-4 bg-background border-4 border-foreground border-dashed text-foreground font-bold uppercase outline-none opacity-40 cursor-not-allowed text-base md:h-10 md:text-sm";

export const primaryActionClass =
  "min-h-12 bg-es-lilac border-4 border-foreground text-foreground font-black text-[11px] md:text-sm uppercase tracking-[0.16em] flex items-center justify-between gap-3 px-5 md:px-8 shadow-editorial hover:shadow-editorial-hover active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all group disabled:opacity-70 disabled:cursor-not-allowed";

export const primaryActionBlockClass = `w-full ${primaryActionClass}`;

export const primaryActionWideClass = `w-full sm:w-2/3 ${primaryActionClass}`;

export const primaryActionCenteredClass =
  "min-h-12 bg-es-lilac border-4 border-foreground text-foreground font-black text-[11px] md:text-sm uppercase tracking-[0.16em] flex items-center justify-center gap-3 px-5 md:px-8 shadow-editorial hover:shadow-editorial-hover active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all disabled:opacity-70 disabled:cursor-not-allowed";

export const primaryActionCenteredBlockClass = `w-full ${primaryActionCenteredClass}`;

export const secondaryActionClass =
  "min-h-12 bg-white border-4 border-foreground text-foreground font-black text-[11px] md:text-sm uppercase tracking-[0.16em] flex items-center justify-center px-5 hover:shadow-editorial-hover active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all";

export const secondaryActionWideClass = `w-full sm:w-1/3 ${secondaryActionClass}`;

export const inlinePrimaryActionClass =
  "min-h-12 bg-es-lilac border-4 border-foreground text-foreground font-black text-[11px] md:text-sm uppercase tracking-[0.16em] flex items-center justify-center gap-3 px-5 md:px-8 shadow-editorial hover:shadow-editorial-hover active:translate-y-0.5 active:translate-x-0.5 transition-all cursor-pointer";

export const alertClass =
  "bg-es-orange border-4 border-foreground p-4 flex items-center gap-3 shadow-editorial-sm";

export const statusMessageClass =
  "border-4 p-4 text-sm font-bold uppercase tracking-widest";
