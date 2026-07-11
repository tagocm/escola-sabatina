# Design Tokens

## Source Of Truth

The app follows a three-layer token model:

- CSS runtime tokens live in `app/globals.css`.
- TypeScript/DTCG-style tokens live in `components/ui/design-tokens.ts`.
- Reusable component class contracts live in `components/ui/design-system.ts`.

New UI work should import from `components/ui/design-system.ts` before writing raw Tailwind utility strings.

## Governance Preset

Preset: `operational_system + mobile_app`

Strictness: `medium`

The app is an operational tool used repeatedly on mobile and desktop. The design language is editorial/brutalist:

- flat cream app background;
- white raised surfaces;
- black `4px` primary borders;
- hard offset shadows;
- square corners by default;
- strong flat accents: orange, yellow, lilac, green and blue;
- uppercase labels with heavy weight;
- polaroid-style student media in attendance and student-related flows.

## Token Layers

Primitive tokens define raw values: color, type, spacing, sizing, border, radius, shadow, motion, opacity, z-index and breakpoints.

Semantic tokens define meaning: background, foreground, surface, surface-warm, surface-muted, surface-soft, surface-pattern, border, primary, pending, success, warning, info, danger, overlays and chart colors.

Component tokens define contracts: page shell, surfaces, cards, fields, buttons, icon buttons, badges, search bars, polaroids, bottom sheets, modals, alerts and empty states.

## Required Usage

Use these imports for common UI:

```ts
import {
  pageShellClass,
  pageMainClass,
  surfaceClass,
  textInputClass,
  primaryActionClass,
  secondaryActionClass,
  polaroidTileClass,
  bottomSheetClass,
} from "@/components/ui/design-system";
```

Use CSS variables only when a class contract does not exist yet:

```css
background: var(--surface);
border: var(--border-strong) solid var(--border);
box-shadow: var(--shadow-editorial-sm);
```

Raw palette utilities such as `bg-white`, `text-white`, `bg-black/*`, `bg-red-*`, `bg-[#...]`, `#hex` and `rgba(...)` are not allowed in app UI files. Use semantic Tailwind aliases such as `bg-surface`, `text-surface`, `bg-surface-warm`, `bg-surface-muted`, `bg-surface-soft`, `bg-surface-pattern`, `bg-danger`, `text-danger`, or CSS variables from `app/globals.css`.

## Component Contracts

Page shells must use `pageShellClass` and `pageMainClass`.

Primary raised panels must use `surfaceClass` or `surfaceSoftClass`.

Forms must use `fieldLabelClass` plus one of `textInputClass`, `compactInputClass`, `mutedInputClass` or `readonlyInputClass`.

Actions must use `primaryActionClass`, `primaryActionCenteredClass`, `secondaryActionClass` or `iconButtonClass`.

Attendance/student photo lists should use the polaroid contract: `polaroidTileClass`, `polaroidMediaClass`, `polaroidCaptionClass` and `statusBadgeClass`.

Floating interactions should use `bottomSheetClass` for mobile-first sheets and `modalPanelClass` for blocking dialogs.

## Scoring Period Patterns

Quarter-aware screens must use the same shared patterns instead of creating route-specific controls:

- `ScoringPeriodSelector`: a labeled, mobile-safe period selector using `compactInputClass`;
- `ScoringPeriodStatusPanel`: a text-first status and completeness summary that distinguishes elapsed, with-record and completed Saturdays;
- `ScoringPeriodDateGrid`: an ordered grid of the 13 Saturdays in the selected period. Each date is a keyboard-accessible, 44px-plus navigation target to its attendance record, with editability explained in text;
- `ScoringPeriodAuditWorkbench`: a `surfaceClass` review surface with explicit pending, resolved and blocked states.

Period state must never be conveyed by color alone. Use the canonical Portuguese labels `Programado`, `Em andamento`, `Encerrado - aguardando auditoria`, `Auditoria em andamento`, and `Auditado - somente leitura`. Corrections in an ended period must display a warning and require an explicit reason; audited periods render all mutation controls disabled or absent.

## Accessibility Baseline

- Touch targets must be at least `44px`.
- Focus must remain visible through `:focus-visible` and the lilac ring token.
- Icon-only buttons must have an accessible label.
- Forms must have labels and associated error text.
- Dialogs and sheets must close with Escape and provide a labeled dialog role.
- Do not communicate state by color alone; pair color with text, icon or count.

## Exception Policy

Existing screens still contain inline Tailwind arbitrary values and direct color usage. They are grandfathered until touched.

For new or modified UI, exceptions are allowed only when:

- no token/contract exists yet;
- the value is local to a specific layout constraint;
- the exception is small and can be promoted to a token if repeated.

Repeated values should be promoted into `design-tokens.ts` and exported through `design-system.ts`.
