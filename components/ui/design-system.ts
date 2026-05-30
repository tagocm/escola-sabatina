import { designTokens } from "./design-tokens";

export { designTokens };
export type { DesignTokens } from "./design-tokens";

const componentTokens = designTokens.component;

export const pageShellClass = componentTokens.shell.page.className;

export const pageMainClass = componentTokens.shell.main.className;

export const stackedPageClass = componentTokens.shell.stack.className;

export const surfaceClass = componentTokens.surface.raised.className;

export const surfaceSoftClass = componentTokens.surface.soft.className;

export const surfaceMutedClass = componentTokens.surface.muted.className;

export const emptyStateClass = componentTokens.surface.empty.className;

export const gridCardClass = componentTokens.card.grid.className;

export const listCardClass = componentTokens.card.list.className;

export const fieldLabelClass = componentTokens.typography.label.className;

export const fieldLabelAccentClass = `${fieldLabelClass} text-es-lilac`;

export const fieldLabelMutedClass = componentTokens.typography.labelMuted.className;

export const sectionTitleClass = componentTokens.typography.sectionTitle.className;

export const pageTitleClass = componentTokens.typography.pageTitle.className;

export const textInputClass = componentTokens.field.text.className;

export const compactInputClass = componentTokens.field.compact.className;

export const mutedInputClass = componentTokens.field.muted.className;

export const readonlyInputClass = componentTokens.field.readonly.className;

export const primaryActionClass = componentTokens.button.primary.className;

export const primaryActionBlockClass = `w-full ${primaryActionClass}`;

export const primaryActionWideClass = `w-full sm:w-2/3 ${primaryActionClass}`;

export const primaryActionCenteredClass = componentTokens.button.primaryCentered.className;

export const primaryActionCenteredBlockClass = `w-full ${primaryActionCenteredClass}`;

export const secondaryActionClass = componentTokens.button.secondary.className;

export const secondaryActionWideClass = `w-full sm:w-1/3 ${secondaryActionClass}`;

export const inlinePrimaryActionClass = `${componentTokens.button.primaryCentered.className} cursor-pointer`;

export const iconButtonClass = componentTokens.button.icon.className;

export const interactiveTargetClass = componentTokens.interactive.target.className;

export const polaroidTileClass = componentTokens.polaroid.tile.className;

export const polaroidMediaClass = componentTokens.polaroid.media.className;

export const polaroidCaptionClass = componentTokens.polaroid.caption.className;

export const statusBadgeClass = componentTokens.badge.status.className;

export const counterBadgeClass = componentTokens.badge.counter.className;

export const stickySearchBarClass = componentTokens.search.stickyBar.className;

export const searchClearButtonClass = componentTokens.search.clearButton.className;

export const modalOverlayClass = componentTokens.modal.overlay.className;

export const modalPanelClass = componentTokens.modal.panel.className;

export const bottomSheetClass = componentTokens.modal.sheet.className;

export const alertClass = componentTokens.alert.warning.className;

export const statusMessageClass = componentTokens.alert.status.className;
