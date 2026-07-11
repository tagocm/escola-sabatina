const token = <T extends string>(type: string, value: T, description: string) => ({
  $type: type,
  $value: value,
  $description: description,
});

export const designTokens = {
  primitive: {
    color: {
      neutral: {
        ink: token("color", "#111111", "Deep ink used for text, borders and hard shadows."),
        paper: token("color", "#F7F6EF", "Flat cream app background."),
        white: token("color", "#FFFFFF", "Primary raised surface."),
        photo: token("color", "#F0F0F0", "Muted media placeholder fill."),
        warmPaper: token("color", "#FFFCEE", "Warm sheet and note surface."),
        softPaper: token("color", "#F8F4E8", "Alternating row and subtle panel fill."),
        patternPaper: token("color", "#F6F1DF", "Calendar responsibility pattern surface."),
      },
      brand: {
        orange: token("color", "#F47A3A", "Editorial orange accent for alerts and energetic actions."),
        yellow: token("color", "#F2D230", "Editorial yellow accent for pending and attention states."),
        lilac: token("color", "#8F96F4", "Editorial lilac accent for primary CTA and focus."),
        green: token("color", "#19BF1A", "Editorial green accent for completed and positive states."),
        blue: token("color", "#72B7E6", "Editorial blue accent for attendance and save actions."),
      },
      feedback: {
        danger: token("color", "#EF4444", "Danger and destructive text fallback."),
      },
    },
    typography: {
      family: {
        sans: token("fontFamily", "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif", "Interface family."),
        mono: token("fontFamily", "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace", "Numeric and technical family."),
      },
      fontSize: {
        micro: token("dimension", "8px", "Dense metadata labels."),
        caption: token("dimension", "9px", "Utility captions."),
        label: token("dimension", "10px", "Default form and card labels."),
        control: token("dimension", "11px", "Button and control labels."),
        bodySm: token("dimension", "13px", "Compact body text."),
        body: token("dimension", "16px", "Mobile-safe input body text."),
        titleSm: token("dimension", "20px", "Compact section titles."),
        title: token("dimension", "24px", "Mobile page/card titles."),
        display: token("dimension", "32px", "Primary page display titles."),
      },
      fontWeight: {
        regular: token("fontWeight", "400", "Normal text."),
        bold: token("fontWeight", "700", "Strong body text."),
        black: token("fontWeight", "900", "Editorial title and label weight."),
      },
      lineHeight: {
        none: token("number", "1", "Stacked uppercase title line-height."),
        tight: token("number", "1.1", "Compact title line-height."),
        relaxed: token("number", "1.55", "Long form readability."),
      },
    },
    letterSpacing: {
      none: token("dimension", "0", "Default letter spacing; never use negative tracking as a token."),
      tight: token("dimension", "0.02em", "Small uppercase tightening without negative spacing."),
      label: token("dimension", "0.16em", "Default uppercase label tracking."),
      wide: token("dimension", "0.18em", "High-emphasis uppercase labels."),
      widest: token("dimension", "0.22em", "Sparse metadata labels."),
    },
    spacing: {
      0: token("dimension", "0", "No spacing."),
      1: token("dimension", "4px", "Hairline spacing."),
      2: token("dimension", "8px", "Small rhythm."),
      3: token("dimension", "12px", "Compact component gap."),
      4: token("dimension", "16px", "Default mobile padding."),
      5: token("dimension", "20px", "Large mobile padding."),
      6: token("dimension", "24px", "Section padding."),
      8: token("dimension", "32px", "Desktop rhythm."),
      10: token("dimension", "40px", "Large section rhythm."),
      16: token("dimension", "64px", "Hero or empty-state rhythm."),
    },
    size: {
      touch: token("dimension", "44px", "Minimum touch target."),
      control: token("dimension", "48px", "Default control height."),
      controlLg: token("dimension", "56px", "Prominent mobile control height."),
      iconSm: token("dimension", "16px", "Small icon size."),
      icon: token("dimension", "20px", "Default icon size."),
      iconLg: token("dimension", "24px", "Large icon size."),
      pageMax: token("dimension", "72rem", "Default content max-width."),
      polaroidMin: token("dimension", "204px", "Minimum mobile polaroid tile height."),
      sheetMax: token("dimension", "42rem", "Floating sheet max-width."),
    },
    radius: {
      none: token("dimension", "0", "Editorial square corners."),
      pill: token("dimension", "999px", "Use only for circular controls or badges."),
    },
    border: {
      thin: token("dimension", "2px", "Internal or secondary border."),
      strong: token("dimension", "4px", "Primary editorial border."),
      heavy: token("dimension", "8px", "Hero/error emphasis border."),
    },
    shadow: {
      hard: token("shadow", "6px 6px 0 0 var(--foreground)", "Primary hard editorial shadow."),
      hardSm: token("shadow", "4px 4px 0 0 var(--foreground)", "Compact hard editorial shadow."),
      hardHover: token("shadow", "2px 2px 0 0 var(--foreground)", "Pressed/hover hard shadow."),
      none: token("shadow", "none", "No shadow."),
    },
    motion: {
      fast: token("duration", "120ms", "Immediate control response."),
      normal: token("duration", "200ms", "Default UI transition."),
      slow: token("duration", "300ms", "Sheet and image transitions."),
      easing: token("cubicBezier", "cubic-bezier(0.2, 0, 0, 1)", "Crisp product easing."),
    },
    opacity: {
      disabled: token("number", "0.6", "Disabled controls."),
      muted: token("number", "0.45", "Secondary labels."),
      subtle: token("number", "0.3", "Quiet metadata and borders."),
      overlay: token("number", "0.45", "Modal overlay opacity."),
    },
    zIndex: {
      sticky: token("number", "20", "Sticky filter bars."),
      popover: token("number", "40", "Dropdowns and popovers."),
      sheet: token("number", "110", "Floating bottom sheets."),
      modal: token("number", "130", "Blocking dialogs."),
      topbar: token("number", "9999", "Global decorative/status bar."),
    },
    breakpoint: {
      sm: token("dimension", "640px", "Small devices."),
      md: token("dimension", "768px", "Tablet and medium devices."),
      lg: token("dimension", "1024px", "Desktop."),
      xl: token("dimension", "1280px", "Wide desktop."),
    },
  },
  semantic: {
    color: {
      background: token("color", "var(--color-paper)", "App background."),
      foreground: token("color", "var(--color-ink)", "Text and border foreground."),
      surface: token("color", "var(--color-white)", "Raised white surface."),
      surfaceWarm: token("color", "var(--color-warm-paper)", "Bottom sheet and note surface."),
      surfaceMuted: token("color", "var(--color-photo)", "Media placeholders."),
      surfaceSoft: token("color", "var(--color-soft-paper)", "Subtle row/panel fill."),
      surfacePattern: token("color", "var(--color-pattern-paper)", "Patterned operational panels."),
      border: token("color", "var(--color-ink)", "Primary border color."),
      input: token("color", "var(--color-white)", "Input field background."),
      ring: token("color", "var(--color-lilac)", "Focus ring color."),
      primary: token("color", "var(--color-lilac)", "Default primary action."),
      secondary: token("color", "var(--color-white)", "Default secondary action."),
      pending: token("color", "var(--color-yellow)", "Pending state."),
      success: token("color", "var(--color-green)", "Completed state."),
      info: token("color", "var(--color-blue)", "Attendance/save state."),
      warning: token("color", "var(--color-orange)", "Warning state."),
      danger: token("color", "var(--color-danger)", "Danger state."),
      overlaySoft: token("color", "var(--overlay-soft)", "Light overlay for media processing."),
      overlayModal: token("color", "var(--overlay-modal)", "Default blocking overlay."),
      overlayStrong: token("color", "var(--overlay-strong)", "Higher-emphasis blocking overlay."),
      chartGrid: token("color", "var(--chart-grid)", "Chart grid strokes."),
      chartLabel: token("color", "var(--chart-label)", "Chart axis labels."),
      chartValue: token("color", "var(--chart-value)", "Chart value labels."),
    },
    focus: {
      ringWidth: token("dimension", "4px", "Visible keyboard focus outline."),
      ringOffset: token("dimension", "2px", "Focus offset from component edge."),
    },
  },
  component: {
    shell: {
      page: {
        className: "flex min-h-screen flex-col items-center justify-start gap-4 overflow-x-hidden bg-background px-3 pb-20 pt-4 md:gap-8 md:px-6 lg:px-8 selection:bg-foreground selection:text-surface",
      },
      main: {
        className: "relative z-10 flex w-full max-w-6xl flex-col gap-6 md:gap-8",
      },
      stack: {
        className: "flex flex-col gap-6 md:gap-8",
      },
    },
    surface: {
      raised: {
        className: "bg-surface border-4 border-foreground shadow-editorial",
      },
      soft: {
        className: "bg-surface border-4 border-foreground shadow-editorial-sm",
      },
      muted: {
        className: "bg-background border-4 border-foreground shadow-editorial-sm",
      },
      empty: {
        className: "w-full bg-surface border-4 border-foreground px-6 py-10 md:p-16 flex flex-col items-center justify-center text-center gap-5 md:gap-6 shadow-editorial",
      },
    },
    typography: {
      label: {
        className: "text-[10px] md:text-[11px] font-black uppercase tracking-[0.16em] leading-none",
      },
      labelMuted: {
        className: "text-[10px] md:text-[11px] font-black uppercase tracking-[0.16em] leading-none opacity-40 italic",
      },
      sectionTitle: {
        className: "text-xl font-black uppercase tracking-tighter leading-none",
      },
      pageTitle: {
        className: "text-[32px] font-black uppercase tracking-tighter leading-none md:text-[48px]",
      },
    },
    field: {
      text: {
        className: "w-full h-12 px-4 bg-surface border-4 border-foreground text-foreground font-black uppercase tracking-[0.08em] outline-none focus:shadow-editorial-sm focus-visible:ring-4 focus-visible:ring-es-lilac transition-all text-base md:h-11 md:text-sm",
      },
      compact: {
        className: "w-full h-12 px-4 bg-surface border-4 border-foreground text-foreground font-bold uppercase outline-none focus:bg-es-lilac/10 focus-visible:ring-4 focus-visible:ring-es-lilac transition-colors text-base md:h-10 md:text-sm",
      },
      muted: {
        className: "w-full h-12 px-4 bg-background border-4 border-foreground text-foreground font-bold uppercase outline-none text-base md:h-10 md:text-sm",
      },
      readonly: {
        className: "w-full h-12 px-4 bg-background border-4 border-foreground border-dashed text-foreground font-bold uppercase outline-none opacity-40 cursor-not-allowed text-base md:h-10 md:text-sm",
      },
    },
    button: {
      primary: {
        className: "min-h-12 bg-es-lilac border-4 border-foreground text-foreground font-black text-[11px] md:text-sm uppercase tracking-[0.16em] flex items-center justify-between gap-3 px-5 md:px-8 shadow-editorial hover:shadow-editorial-hover active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all group disabled:opacity-70 disabled:cursor-not-allowed",
      },
      primaryCentered: {
        className: "min-h-12 bg-es-lilac border-4 border-foreground text-foreground font-black text-[11px] md:text-sm uppercase tracking-[0.16em] flex items-center justify-center gap-3 px-5 md:px-8 shadow-editorial hover:shadow-editorial-hover active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all disabled:opacity-70 disabled:cursor-not-allowed",
      },
      secondary: {
        className: "min-h-12 bg-surface border-4 border-foreground text-foreground font-black text-[11px] md:text-sm uppercase tracking-[0.16em] flex items-center justify-center px-5 hover:shadow-editorial-hover active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all",
      },
      icon: {
        className: "flex h-11 w-11 items-center justify-center border-4 border-foreground bg-surface shadow-editorial-sm transition-colors hover:bg-background",
      },
    },
    interactive: {
      target: {
        minHeight: token("dimension", "44px", "Minimum mobile interactive height."),
        className: "touch-manipulation focus:outline-none focus-visible:ring-4 focus-visible:ring-es-lilac",
      },
    },
    card: {
      grid: {
        className: "group bg-surface border-4 border-foreground shadow-editorial-sm flex flex-col overflow-hidden transition-all hover:shadow-editorial hover:translate-y-0.5 active:translate-y-1",
      },
      list: {
        className: "bg-surface border-4 border-foreground shadow-editorial-sm p-4 md:p-6 flex flex-col md:flex-row md:items-center gap-4",
      },
    },
    polaroid: {
      tile: {
        className: "relative min-h-[204px] w-full border-4 border-foreground bg-surface p-2.5 pb-4 shadow-editorial-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-editorial active:translate-y-0.5",
      },
      media: {
        className: "relative aspect-square w-full overflow-hidden border-4 border-foreground bg-background",
      },
      caption: {
        className: "mt-3 flex min-h-[50px] flex-col items-center justify-center text-center leading-none",
      },
    },
    badge: {
      status: {
        className: "inline-flex min-h-7 items-center justify-center border-2 border-foreground px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] shadow-editorial-sm",
      },
      counter: {
        className: "flex h-10 min-w-10 items-center justify-center border-4 border-foreground bg-surface px-3 text-sm font-black shadow-editorial-sm",
      },
    },
    search: {
      stickyBar: {
        className: "sticky top-3 z-20 border-4 border-foreground bg-surface p-3 shadow-editorial md:p-4",
      },
      clearButton: {
        className: "absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center border-4 border-foreground bg-surface shadow-editorial-sm transition-colors hover:bg-background",
      },
    },
    modal: {
      overlay: {
        className: "fixed inset-0 z-[130] flex items-end justify-center bg-foreground/35 p-3 backdrop-blur-[2px] md:items-center md:p-4",
      },
      panel: {
        className: "relative z-10 flex max-h-[90svh] w-full max-w-xl flex-col overflow-hidden border-4 border-foreground bg-background shadow-editorial",
      },
      compactPanel: {
        className: "relative z-10 flex max-h-[90svh] w-full max-w-sm flex-col overflow-hidden border-4 border-foreground bg-background shadow-editorial",
      },
      sheet: {
        className: "relative z-10 flex max-h-[92svh] w-full max-w-2xl flex-col overflow-hidden border-t-4 border-foreground bg-background shadow-editorial sm:border-4",
      },
    },
    alert: {
      warning: {
        className: "bg-es-orange border-4 border-foreground p-4 flex items-center gap-3 shadow-editorial-sm",
      },
      status: {
        className: "border-4 p-4 text-sm font-bold uppercase tracking-widest",
      },
    },
  },
} as const;

export type DesignTokens = typeof designTokens;
