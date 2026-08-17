/**
 * How complete is this application, and what's wrong with it?
 *
 * Two separate questions, deliberately kept apart:
 *
 * - `applicationProgress` — which applicable fields are still blank. Drives the
 *   interview (what to ask next) and the sidebar (how far along we are).
 * - `validateApplication` — what's filled in but implausible or against the
 *   rules. DMR's own "Common Application Mistakes" guide, and the form's repeated
 *   warnings that an incomplete application is denied *and the fee forfeited*,
 *   are the reason this exists: catching a 500-square-foot gear layout here costs
 *   nothing, and catching it after mailing a $100 check costs $100.
 *
 * Everything here is a preliminary check, not a determination. Blocking issues
 * are ones where the form or regulation says plainly that the site can't be
 * licensed as described; warnings are everything else worth a second look.
 */
import {
  fieldAnswered,
  fieldApplies,
  LPA_FIELDS,
  LPA_SECTIONS,
  type LpaFieldDef,
  type SectionId,
} from "./fields";
import { LPA_MAX_GEAR_AREA_SQ_FT } from "./constants";
import type { LpaApplication } from "./schema";

/* -------------------------------------------------------------------------- */
/* Progress                                                                    */
/* -------------------------------------------------------------------------- */

export interface SectionProgress {
  id: SectionId;
  title: string;
  answered: number;
  applicable: number;
  complete: boolean;
}

export interface ApplicationProgress {
  answered: number;
  applicable: number;
  /** 0-100, rounded. 100 only when nothing applicable is outstanding. */
  percent: number;
  complete: boolean;
  missing: LpaFieldDef[];
  sections: SectionProgress[];
}

export function applicationProgress(app: LpaApplication): ApplicationProgress {
  const applicable = LPA_FIELDS.filter((field) => fieldApplies(field, app));
  const missing = applicable.filter((field) => !fieldAnswered(field, app));
  const answered = applicable.length - missing.length;

  const sections: SectionProgress[] = LPA_SECTIONS.map((section) => {
    const inSection = applicable.filter((field) => field.section === section.id);
    const answeredHere = inSection.filter((field) => fieldAnswered(field, app)).length;
    return {
      id: section.id,
      title: section.title,
      answered: answeredHere,
      applicable: inSection.length,
      complete: inSection.length > 0 && answeredHere === inSection.length,
    };
  })
    // A section whose fields are all conditional and all ruled out isn't part of
    // this application at all, so it shouldn't appear as "0 of 0 complete".
    .filter((section) => section.applicable > 0);

  return {
    answered,
    applicable: applicable.length,
    percent: applicable.length === 0 ? 0 : Math.round((answered / applicable.length) * 100),
    complete: missing.length === 0,
    missing,
    sections,
  };
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

export interface ValidationIssue {
  /** "blocking" means the site, as described, can't be licensed this way. */
  severity: "blocking" | "warning";
  field: string | null;
  message: string;
}

/** Rough bounding box for Maine's coastal waters, for catching typo'd coordinates. */
const MAINE_LAT = { min: 42.9, max: 47.6 };
const MAINE_LON = { min: -71.2, max: -66.8 };

const MIN_APPLICANT_AGE_YEARS = 12;
const MAX_LPA_LICENSES = 4;
const MAX_ASSISTANTS = 3;

function yearsSince(isoDate: string, now: Date): number | null {
  const then = new Date(isoDate);
  if (Number.isNaN(then.getTime())) return null;
  const years = (now.getTime() - then.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
  return years;
}

/**
 * Reduces a health zone written any number of ways — "Zone 3", "3", "zone three"
 * — to a bare digit, so two spellings of the same zone don't read as a mismatch.
 * Returns null when there's no single digit to find, which makes the comparison
 * skip rather than guess.
 */
function normalizeZone(value: string): string | null {
  const digits = value.match(/[1-5]/g);
  return digits && digits.length === 1 ? digits[0] : null;
}

export function validateApplication(
  app: LpaApplication,
  now: Date = new Date()
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  /* --- Hard stops from the regulation --- */

  if (app.isInEssentialHabitat === true) {
    issues.push({
      severity: "blocking",
      field: "isInEssentialHabitat",
      message:
        "LPA licenses cannot be located within an area designated as Essential Habitat by MDIFW. This site would need to move before it could be licensed.",
    });
  }

  const width = app.gearLayoutWidthFt;
  const length = app.gearLayoutLengthFt;
  if (width !== null && length !== null) {
    const area = width * length;
    if (area > LPA_MAX_GEAR_AREA_SQ_FT) {
      issues.push({
        severity: "blocking",
        field: "gearLayoutWidthFt",
        message: `A ${width} x ${length} ft layout is ${area} sq ft. Gear excluding moorings may not exceed ${LPA_MAX_GEAR_AREA_SQ_FT} sq ft on an LPA. You'd need a smaller footprint, or an experimental or standard lease.`,
      });
    }
    for (const [label, value] of [
      ["Width", width],
      ["Length", length],
    ] as const) {
      if (!Number.isInteger(value) || value < 1) {
        issues.push({
          severity: "warning",
          field: "gearLayoutWidthFt",
          message: `${label} must be given in whole feet and be at least 1. DMR asks for whole-foot dimensions.`,
        });
      }
    }
  }

  if (app.applicantDateOfBirth) {
    const age = yearsSince(app.applicantDateOfBirth, now);
    if (age === null) {
      issues.push({
        severity: "warning",
        field: "applicantDateOfBirth",
        message: "The date of birth doesn't parse as a date. Worth re-checking.",
      });
    } else if (age < MIN_APPLICANT_AGE_YEARS) {
      issues.push({
        severity: "blocking",
        field: "applicantDateOfBirth",
        message: `Applicants must be at least ${MIN_APPLICANT_AGE_YEARS} years old.`,
      });
    }
  }

  if (app.isInRestrictedOrProhibitedArea === true) {
    issues.push({
      severity: "warning",
      field: "isInRestrictedOrProhibitedArea",
      message:
        "In a prohibited, restricted or conditionally restricted area you may culture seed only, within the Chapter 2.95(A)(4) size limits, and you must hold or have an ownership stake in a lease to move it. Sites for human-consumption marine algae also can't sit in the 300:1 dilution area around a wastewater outfall.",
    });
  }

  /* --- Counting limits --- */

  if ((app.otherLpaAcronyms ?? []).length >= MAX_LPA_LICENSES) {
    issues.push({
      severity: "blocking",
      field: "otherLpaAcronyms",
      message: `No individual may hold more than ${MAX_LPA_LICENSES} LPA licenses at once, and you've listed ${app.otherLpaAcronyms!.length} already.`,
    });
  }

  if ((app.assistantNames ?? []).length > MAX_ASSISTANTS) {
    issues.push({
      severity: "warning",
      field: "assistantNames",
      message: `You may designate at most ${MAX_ASSISTANTS} assistants per license.`,
    });
  }

  if (
    app.primaryAssistantName &&
    (app.assistantNames ?? []).length > 0 &&
    !(app.assistantNames ?? []).some(
      (name) =>
        typeof name === "string" &&
        name.trim().toLowerCase() === app.primaryAssistantName!.trim().toLowerCase()
    )
  ) {
    issues.push({
      severity: "warning",
      field: "primaryAssistantName",
      message:
        "The primary assistant has to be one of the assistants you named above. Right now they don't match.",
    });
  }

  if (
    app.ownerOperatorExemption === "ownership_interest_50_plus" &&
    app.exemptionOwnershipPercent !== null &&
    app.exemptionOwnershipPercent < 50
  ) {
    issues.push({
      severity: "warning",
      field: "exemptionOwnershipPercent",
      message:
        "This exemption needs a 50% or greater ownership interest. Below 50%, only one shareholder may claim it and no one else can have claimed it already.",
    });
  }

  /* --- Coordinates --- */

  if (app.latitude !== null && (app.latitude < MAINE_LAT.min || app.latitude > MAINE_LAT.max)) {
    issues.push({
      severity: "warning",
      field: "latitude",
      message: `A latitude of ${app.latitude} falls outside Maine. DMR wants decimal degrees for the center point of the site.`,
    });
  }
  if (app.longitude !== null) {
    if (app.longitude > 0) {
      issues.push({
        severity: "warning",
        field: "longitude",
        message: `Maine longitudes are west, so they're negative. ${app.longitude} should probably be -${app.longitude}.`,
      });
    } else if (app.longitude < MAINE_LON.min || app.longitude > MAINE_LON.max) {
      issues.push({
        severity: "warning",
        field: "longitude",
        message: `A longitude of ${app.longitude} falls outside Maine.`,
      });
    }
  }

  /* --- Cross-field consistency --- */

  if (
    app.depthAtMeanLowWaterFt !== null &&
    app.depthAtMeanHighWaterFt !== null &&
    app.depthAtMeanHighWaterFt < app.depthAtMeanLowWaterFt
  ) {
    issues.push({
      severity: "warning",
      field: "depthAtMeanHighWaterFt",
      message:
        "Depth at mean high water is usually greater than at mean low water, so these two look swapped.",
    });
  }

  const sources = [...(app.hatcheryStock ?? []), ...(app.wildStock ?? [])].filter(Boolean);
  if (app.hatcheryStock !== null && app.wildStock !== null && sources.length === 0) {
    issues.push({
      severity: "warning",
      field: "hatcheryStock",
      message: "No species are listed yet. The form needs at least one species and its stock source.",
    });
  }

  if (
    app.hasNoNearbyFeatures === false &&
    (app.nearbyFeatures ?? []).some((entry) => !entry?.impact || entry.impact.trim() === "")
  ) {
    issues.push({
      severity: "warning",
      field: "nearbyFeatures",
      message:
        "Every feature within 1,000 feet needs an impact description alongside it. The form asks for both.",
    });
  }

  // Wild stock must originate from the applicant's own health zone (DMR Rule
  // Chapter 2.05(1)(J)). This is a mismatch the applicant can easily miss —
  // they name a harvester they've always used, without checking which zone that
  // harvester fishes. Hatchery stock is exempt, which is why only wildStock is
  // checked here.
  if (app.lpaHealthZone) {
    const siteZone = normalizeZone(app.lpaHealthZone);
    for (const source of (app.wildStock ?? []).filter(Boolean)) {
      if (typeof source.healthZone !== "string" || source.healthZone.trim() === "") continue;
      const sourceZone = normalizeZone(source.healthZone);
      if (siteZone && sourceZone && siteZone !== sourceZone) {
        issues.push({
          severity: "blocking",
          field: "wildStock",
          // Uses the normalized digits, not the raw strings, so the message
          // doesn't read "zone Zone 3" when the applicant wrote it out.
          message: `${source.species ?? "That wild stock"} is listed as coming from health zone ${sourceZone}, but the site is in health zone ${siteZone}. Wild stock and seed must originate from the same LPA health zone as the license site.`,
        });
      }
    }
  }

  if (app.hasEagleNestWithin660Ft === true) {
    issues.push({
      severity: "warning",
      field: "hasEagleNestWithin660Ft",
      message:
        "US Fish & Wildlife recommends keeping all structures and activity at least 660 feet from an active eagle nest. Expect questions about this.",
    });
  }

  return issues;
}
