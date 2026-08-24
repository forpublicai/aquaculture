/**
 * What's wrong with this Experimental lease application?
 *
 * Validity checks against the limits printed on the form and in the
 * application instructions. Completeness lives in the shared progress module;
 * this file is only the Experimental lease's own rules.
 *
 * Everything here is a preliminary check, not a determination. Blocking issues
 * are ones where the regulation says plainly the application can't be granted
 * as described; warnings are everything else worth a second look.
 */
import type { ValidationIssue } from "../definition";

import type { ExperimentalApplication } from "./schema";

export const EXPERIMENTAL_MAX_ACRES = 4;
export const EXPERIMENTAL_MAX_TERM_YEARS = 3;
export const MAX_CORNERS = 15;
export const RENT_PER_ACRE = 100;

/** Rough bounding box for Maine's coastal waters, for catching typo'd coordinates. */
const MAINE_LAT = { min: 42.9, max: 47.6 };
const MAINE_LON = { min: -71.2, max: -66.8 };

/**
 * The month a free-text observation date names, or null when there isn't
 * exactly one to find. Handles "June 2026", "6/12/2026", "2026-06-12". Null
 * means "don't judge", never a guess: these are free-text fields and a wrong
 * challenge trains people to click past warnings.
 */
function monthOf(text: string): number | null {
  const names = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ];
  const lower = text.toLowerCase();
  const named = names
    .map((name, index) => (lower.includes(name) ? index + 1 : null))
    .filter((month): month is number => month !== null);
  if (named.length === 1) return named[0];
  if (named.length > 1) return null;

  const iso = text.match(/\b\d{4}-(\d{1,2})-\d{1,2}\b/);
  if (iso) return Number(iso[1]);
  const us = text.match(/\b(\d{1,2})\/\d{1,2}\/\d{2,4}\b/);
  if (us) return Number(us[1]);
  return null;
}

/** The observation-date fields bound to the April 1 – November 15 window. */
const WINDOWED_OBSERVATION_DATES: {
  key: keyof ExperimentalApplication;
  label: string;
}[] = [
  { key: "bottomObservationDate", label: "The bottom observation" },
  { key: "currentSpeedObservationDate", label: "The current-speed observation" },
  { key: "currentDirectionObservationDate", label: "The current-direction observation" },
  { key: "faunaObservationDate", label: "The fauna observation" },
  { key: "floraObservationDate", label: "The flora observation" },
  { key: "eelgrassWithinSiteDate", label: "The on-site eelgrass observation" },
  { key: "eelgrassWithin1000FtDate", label: "The 1,000-foot eelgrass observation" },
];

export function validateApplication(
  app: ExperimentalApplication,
  now: Date = new Date()
): ValidationIssue[] {
  void now; // Same signature as every form's validate; nothing here is date-relative yet.
  const issues: ValidationIssue[] = [];

  /* --- Hard limits from the regulation --- */

  if (app.totalAcreage !== null) {
    if (app.totalAcreage > EXPERIMENTAL_MAX_ACRES) {
      issues.push({
        severity: "blocking",
        field: "totalAcreage",
        message: `An experimental lease may cover at most ${EXPERIMENTAL_MAX_ACRES} acres, and ${app.totalAcreage} is over that. A larger site needs a standard lease.`,
      });
    } else if (app.totalAcreage <= 0) {
      issues.push({
        severity: "warning",
        field: "totalAcreage",
        message: "The acreage requested has to be a positive number of acres.",
      });
    }
  }

  if (app.leaseTermYears !== null) {
    if (app.leaseTermYears > EXPERIMENTAL_MAX_TERM_YEARS) {
      issues.push({
        severity: "blocking",
        field: "leaseTermYears",
        message: `An experimental lease runs at most ${EXPERIMENTAL_MAX_TERM_YEARS} years, and ${app.leaseTermYears} is over that. A longer term needs a standard lease.`,
      });
    } else if (app.leaseTermYears <= 0) {
      issues.push({
        severity: "warning",
        field: "leaseTermYears",
        message: "The lease term has to be a positive number of years.",
      });
    }
  }

  if (app.pendingApplicationCount === "two") {
    issues.push({
      severity: "warning",
      field: "pendingApplicationCount",
      message:
        "Two pending experimental leases is the regulatory maximum, counting applications by any entity you have a legal interest in. A third can't be filed until one resolves.",
    });
  }

  /* --- The study --- */

  if (app.studyType === "commercial_research") {
    issues.push({
      severity: "warning",
      field: "studyType",
      message:
        "A commercial research lease can't be renewed. To keep the site past the term, you'd file a standard lease application before this one expires.",
    });
  }

  /* --- Depths and coordinates --- */

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

  const corners = (app.corners ?? []).filter(
    (corner): corner is { latitude: number; longitude: number } =>
      !!corner && typeof corner === "object"
  );
  if ((app.corners ?? []).length > 0) {
    if (corners.length < 3) {
      issues.push({
        severity: "warning",
        field: "corners",
        message:
          "A site boundary needs at least three corners. The form's table starts at the NW corner and proceeds clockwise.",
      });
    }
    if (corners.length > MAX_CORNERS) {
      issues.push({
        severity: "warning",
        field: "corners",
        message: `The form's coordinate table has room for ${MAX_CORNERS} corners, and this site has ${corners.length}.`,
      });
    }
    corners.forEach((corner, index) => {
      const label = `Corner ${index + 1}`;
      if (
        typeof corner.latitude === "number" &&
        (corner.latitude < MAINE_LAT.min || corner.latitude > MAINE_LAT.max)
      ) {
        issues.push({
          severity: "warning",
          field: "corners",
          message: `${label}'s latitude of ${corner.latitude} falls outside Maine.`,
        });
      }
      if (typeof corner.longitude === "number") {
        if (corner.longitude > 0) {
          issues.push({
            severity: "warning",
            field: "corners",
            message: `Maine longitudes are west, so they're negative. ${label}'s ${corner.longitude} should probably be -${corner.longitude}.`,
          });
        } else if (corner.longitude < MAINE_LON.min || corner.longitude > MAINE_LON.max) {
          issues.push({
            severity: "warning",
            field: "corners",
            message: `${label}'s longitude of ${corner.longitude} falls outside Maine.`,
          });
        }
      }
    });
  }

  /* --- Observation dates: April 1 to November 15, dates inclusive --- */

  for (const { key, label } of WINDOWED_OBSERVATION_DATES) {
    const value = app[key];
    if (typeof value !== "string" || value.trim() === "") continue;
    const month = monthOf(value);
    if (month === null) continue;
    // A November date is only out of the window after the 15th, and free text
    // rarely pins the day down, so November gets the benefit of the doubt.
    if (month >= 4 && month <= 11) continue;
    issues.push({
      severity: "warning",
      field: key,
      message: `${label} is dated "${value}", which falls outside the April 1 to November 15 window. DMR won't accept observation dates outside it, so this one would need redoing in season.`,
    });
  }

  if (app.iceFormationDescription) {
    const text = app.iceFormationDescription.trim();
    if (/\bno ice\b/i.test(text) && text.length < 90) {
      issues.push({
        severity: "warning",
        field: "iceFormationDescription",
        message:
          'DMR says plainly that "no ice observed" won\'t be accepted. The description needs data behind it: water temperature or ice-out dates over ten years, or at least five years of observations from the harbormaster, shellfish warden, harbor committee, Marine Patrol, or fishing community.',
      });
    }
  }

  /* --- Stock and water quality --- */

  const tables = [app.hatcheryStock, app.siteStock, app.wildStock];
  if (tables.every((table) => Array.isArray(table)) && tables.every((table) => table!.length === 0)) {
    issues.push({
      severity: "warning",
      field: "hatcheryStock",
      message:
        "All three stock tables are recorded as empty, so the application names no species and no source of stock at all. The form asks you to list every species you intend to cultivate in one of them.",
    });
  }

  if (app.intendsWholeOrRoeOnScallops === true) {
    issues.push({
      severity: "warning",
      field: "intendsWholeOrRoeOnScallops",
      message:
        "Possessing whole or roe-on scallops means regular biotoxin testing at your own expense. DMR asks you to contact DMRPublicHealthDiv@maine.gov to discuss your plans.",
    });
  }

  if (app.growingAreaClassification && app.growingAreaClassification !== "approved") {
    issues.push({
      severity: "warning",
      field: "growingAreaClassification",
      message:
        "For molluscan shellfish in waters classified as anything other than open/approved, DMR requires you to contact DMRPublicHealthDiv@maine.gov before proceeding.",
    });
  }

  /* --- Cross-field consistency --- */

  if (app.cultureMethod === "bottom_planting_only" && app.usesSuspendedGear === true) {
    issues.push({
      severity: "warning",
      field: "cultureMethod",
      message:
        "The cultivation method says bottom planting only, with no gear, but the interagency section says suspended gear is proposed. One of the two needs correcting.",
    });
  }

  if (
    app.usesSuspendedGear === true &&
    Array.isArray(app.cultureTypes) &&
    app.cultureTypes.length > 0 &&
    !app.cultureTypes.includes("suspended")
  ) {
    issues.push({
      severity: "warning",
      field: "cultureTypes",
      message:
        "Suspended gear is proposed, but the culture type doesn't include suspended culture. These two answers describe the same thing and should agree.",
    });
  }

  if (app.habitatDesignations && app.habitatDesignations.length > 0) {
    issues.push({
      severity: "warning",
      field: "habitatDesignations",
      message:
        "A site inside a designated habitat area gets close scrutiny from the reviewing agencies. Expect questions, and consider discussing the siting with DMR before submitting.",
    });
  }

  if (app.willDischarge === true) {
    issues.push({
      severity: "warning",
      field: "willDischarge",
      message:
        "Discharging feed or chemical additives brings additional review, and possibly separate permitting. Be ready to describe exactly what would be discharged and how much.",
    });
  }

  /* --- The rent estimate is arithmetic the form states outright --- */

  if (app.annualLeaseRent && app.totalAcreage !== null && app.totalAcreage > 0) {
    const amount = app.annualLeaseRent.replace(/[$,]/g, "").match(/\d+(?:\.\d+)?/);
    if (amount) {
      const stated = Number(amount[0]);
      const expected = app.totalAcreage * RENT_PER_ACRE;
      // Only flag a clear mismatch: the field is free text and may bundle an
      // explanation with the number.
      if (Number.isFinite(stated) && Math.abs(stated - expected) > expected * 0.25 + 1) {
        issues.push({
          severity: "warning",
          field: "annualLeaseRent",
          message: `Annual rent is $${RENT_PER_ACRE} per acre, which for ${app.totalAcreage} acres comes to $${expected}. The estimate here reads as $${stated}.`,
        });
      }
    }
  }

  return issues;
}
