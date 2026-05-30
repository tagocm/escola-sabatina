# Design System Instructions

Use `components/ui/design-system.ts` as the app-wide design API.

New UI should follow the editorial mobile-first system:

- cream background via `bg-background`;
- raised surfaces via `bg-surface` with `border-4 border-foreground`;
- hard shadows through `shadow-editorial` or `shadow-editorial-sm`;
- square corners unless the component is intentionally circular;
- strong flat accents through `bg-es-orange`, `bg-es-yellow`, `bg-es-lilac`, `bg-es-green` and `bg-es-blue`;
- uppercase heavy labels using `fieldLabelClass`;
- mobile controls with at least a `44px` target.

Prefer exported contracts:

- `pageShellClass`, `pageMainClass`, `stackedPageClass`;
- `surfaceClass`, `surfaceSoftClass`, `emptyStateClass`;
- `textInputClass`, `compactInputClass`, `readonlyInputClass`;
- `primaryActionClass`, `primaryActionCenteredClass`, `secondaryActionClass`, `iconButtonClass`;
- `polaroidTileClass`, `polaroidMediaClass`, `polaroidCaptionClass`;
- `stickySearchBarClass`, `bottomSheetClass`, `modalPanelClass`;
- `statusBadgeClass`, `counterBadgeClass`.

When a new visual pattern repeats, add it first to `components/ui/design-tokens.ts`, then expose a class contract in `components/ui/design-system.ts`. Avoid one-off raw colors, shadows, radii, and hardcoded component geometry in business screens.

Do not use raw palette classes or color literals in app UI files: `bg-white`, `text-white`, `bg-black/*`, `bg-red-*`, `bg-[#...]`, `#hex`, `rgb(...)`, or `rgba(...)`. Use semantic aliases from `app/globals.css` such as `bg-surface`, `text-surface`, `bg-surface-warm`, `bg-surface-muted`, `bg-surface-soft`, `bg-surface-pattern`, `bg-danger`, and `text-danger`.
