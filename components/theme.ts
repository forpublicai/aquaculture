/**
 * The two design-token references used in more than one component.
 *
 * These were duplicated in `Chat.tsx` and about to be duplicated again in
 * `ApplicationReview.tsx`, which is the point at which a literal repeated in two
 * files starts drifting. Everything else about the visual language lives in the
 * design system's own CSS variables; these are only here because they're
 * referenced from inline `style` objects rather than from classes.
 */
export const HAIRLINE = "var(--border-hairline)";
export const MUTED = "var(--pai-gray-800)";
