/**
 * LPA numbers that more than one module needs.
 *
 * The 400 sq ft cap appears twice in this codebase for two different jobs: in
 * lib/routing/rules.ts it decides whether an LPA is the right license at all,
 * and here it validates the gear layout on the application form. They're the
 * same regulation (DMR Rule Chapter 2.90), so they're the same constant.
 */
export { LPA_MAX_AREA_SQ_FT as LPA_MAX_GEAR_AREA_SQ_FT } from "@/lib/routing/rules";
