/**
 * The parts of the Standard lease applications this app cannot produce.
 *
 * Two lists, one per form, sharing what the printed forms share. The draft's
 * renderings list is shorter — no vicinity map and no equipment-layout
 * renderings — and its schematics ask for less. The final's is the full set.
 * Both fees are non-refundable, and each form is also the USACE application,
 * so each needs its own copy sent to the Corps.
 */
import type { RequirementDef } from "../definition";

import { proposesFloatingStructure, proposesGear, type AnyStandardApplication } from "./fields";

const gearProposed = (app: AnyStandardApplication) => proposesGear(app);
const seasonal = (app: AnyStandardApplication) =>
  proposesGear(app) && app.hasSeasonalGearChanges === true;
const petroleum = (app: AnyStandardApplication) => app.storesPetroleumOnSite === true;
const intertidal = (app: AnyStandardApplication) => app.isAboveMeanLowWater === true;
const municipalVote = (app: AnyStandardApplication) =>
  app.isAboveMeanLowWater === true && app.municipalityHasShellfishProgram === true;
const shorefront = (app: AnyStandardApplication) => app.isWithin1000FtOfShorefront === true;

function fee(amount: string, formName: string): RequirementDef {
  return {
    id: "application_fee",
    kind: "payment",
    label: "Application fee",
    detail:
      `${amount}, non-refundable. Paying by check means mailing the ${formName} with the check, ` +
      'payable to "Treasurer State of Maine". Paying by card, you may mail or email the ' +
      "application and DMR will contact you for payment; never include card details. DMR " +
      "doesn't review the application until payment arrives.",
  };
}

const USACE_COPY: RequirementDef = {
  id: "usace_copy",
  kind: "external_permit",
  label: "Copy to the Army Corps of Engineers",
  detail:
    "This form doubles as the USACE permit application, but you must send them their own copy — by email to Cenae-r-me@usace.army.mil or by mail to the Maine Project Office in Augusta — and manage their process yourself. Their review runs separately from DMR's.",
};

const BOUNDARY_DRAWING: RequirementDef = {
  id: "boundary_drawing",
  kind: "attachment",
  label: "Boundary drawing",
  detail:
    "A rendering labeled 'Boundary Drawing' showing the site's boundaries, with every corner labeled to match the coordinate table: corner 1 at the NW, proceeding clockwise.",
};

const OVERHEAD_VIEW: RequirementDef = {
  id: "overhead_view",
  kind: "attachment",
  label: "Overhead view of gear",
  detail:
    "A rendering labeled 'Overhead View' with the maximum layout of all gear including moorings, each gear type labeled, floats and structures placed, approximate spacing in feet, the site's length and width, the boundaries with corner markers, and gear orientation.",
  appliesWhen: gearProposed,
};

const SEASONAL_OVERHEAD: RequirementDef = {
  id: "seasonal_overhead_view",
  kind: "attachment",
  label: "Seasonal overhead view",
  detail:
    "Because gear deployment changes seasonally, a second overhead view labeled 'Seasonal Overhead View' showing the seasonal layout, with the same labeling as the main one.",
  appliesWhen: seasonal,
};

const CROSS_SECTION: RequirementDef = {
  id: "cross_section_view",
  kind: "attachment",
  label: "Cross section view of gear",
  detail:
    "A rendering labeled 'Cross Section View': the gear in profile as deployed, each type labeled, with mooring type, scope, hardware, and line type and size, and the gear's depth relative to the surface at both mean low and mean high water.",
  appliesWhen: gearProposed,
};

const SEASONAL_CROSS_SECTION: RequirementDef = {
  id: "seasonal_cross_section_view",
  kind: "attachment",
  label: "Seasonal cross section view",
  detail: "A matching 'Seasonal Cross Section View' for the seasonal gear layout.",
  appliesWhen: seasonal,
};

const OIL_SPILL_PLAN: RequirementDef = {
  id: "oil_spill_plan",
  kind: "attachment",
  label: "Oil spill prevention and control plan",
  detail:
    "Because petroleum products are stored on the site: procedures and control measures to prevent spills, and measures to contain, clean up, and mitigate a spill reaching navigable waters or shorelines.",
  appliesWhen: petroleum,
};

const FINANCIAL_LETTER: RequirementDef = {
  id: "financial_institution_letter",
  kind: "attachment",
  label: "Financial institution letter",
  detail:
    "A letter from a financial institution confirming you hold an account in good standing. Every listed applicant submits their own letter.",
};

const RIPARIAN_LIST: RequirementDef = {
  id: "riparian_list_certified",
  kind: "attachment",
  label: "Certified riparian landowner list",
  detail:
    "The riparian landowner list for every shorefront parcel within 1,000 feet, certified by the municipality — typically the town clerk or tax assessor. A site in more than one municipality needs a separate certified list per town.",
  appliesWhen: shorefront,
};

const TAX_MAP: RequirementDef = {
  id: "tax_map",
  kind: "attachment",
  label: "Labeled municipal tax map",
  detail:
    "A labeled tax map showing the town name, clearly numbered parcels, a legible scale, and the boundaries of the proposed lease site.",
  appliesWhen: shorefront,
};

const INTERTIDAL_PERMISSION: RequirementDef = {
  id: "intertidal_landowner_permission",
  kind: "signature",
  label: "Intertidal landowners' written permission",
  detail:
    "Because part of the site is above mean low water: written permission from every riparian owner whose intertidal land you'd use, naming the parcel's map and lot number to match the riparian list, naming every owner of the parcel, and stating plainly that they permit your aquaculture use. A general letter of support doesn't count. If you own the land yourself, an Applicant Statement with the map and lot number stands in. DMR won't accept the application without this.",
  appliesWhen: intertidal,
};

const MUNICIPAL_CONSENT: RequirementDef = {
  id: "municipal_intertidal_consent",
  kind: "attachment",
  label: "Municipal vote on intertidal use",
  detail:
    "Because the town has a shellfish conservation program: a majority of municipal officers must vote at a public meeting to permit your use of the intertidal area. Submit the final meeting minutes with the motion's text and the vote, or a letter summarizing the meeting with the date, the motion, each officer's vote by name, and the name of whoever submits it. Draft minutes aren't accepted.",
  appliesWhen: municipalVote,
};

export const STANDARD_DRAFT_REQUIREMENTS: RequirementDef[] = [
  fee("$500", "draft application"),
  USACE_COPY,
  BOUNDARY_DRAWING,
  OVERHEAD_VIEW,
  SEASONAL_OVERHEAD,
  CROSS_SECTION,
  SEASONAL_CROSS_SECTION,
  {
    id: "structure_schematics",
    kind: "attachment",
    label: "Structure and float schematics",
    detail:
      "Schematics or photos of every proposed structure or float, showing the approximate location of any mechanized equipment used or stored on it, labeled.",
    appliesWhen: proposesFloatingStructure,
  },
  OIL_SPILL_PLAN,
  FINANCIAL_LETTER,
  RIPARIAN_LIST,
  TAX_MAP,
  INTERTIDAL_PERMISSION,
  MUNICIPAL_CONSENT,
  {
    id: "acknowledgement_page",
    kind: "signature",
    label: "Acknowledgement and signature page",
    detail:
      "Every listed applicant completes and signs the acknowledgement page, including the draft-specific acknowledgements: that a final application will eventually be required with additional information, and that public feedback from the scoping session should shape the final proposal. For a company, someone authorized to certify on its behalf signs.",
  },
];

export const STANDARD_FINAL_REQUIREMENTS: RequirementDef[] = [
  fee("$1,000", "final application"),
  USACE_COPY,
  BOUNDARY_DRAWING,
  {
    id: "vicinity_map",
    kind: "attachment",
    label: "Vicinity map",
    detail:
      "A NOAA chart labeled 'Vicinity Map' showing at least 3,000 feet around the site, with the lease boundaries, a 1,000-foot buffer around each corner, an arrow indicating true north, and a scale bar.",
  },
  OVERHEAD_VIEW,
  SEASONAL_OVERHEAD,
  CROSS_SECTION,
  SEASONAL_CROSS_SECTION,
  {
    id: "structure_schematics",
    kind: "attachment",
    label: "Structure and float schematics",
    detail:
      "Schematics or photos of every proposed structure or float, showing the location of any lights and the approximate location of any mechanized equipment used or stored on it, labeled.",
    appliesWhen: proposesFloatingStructure,
  },
  {
    id: "equipment_layout",
    kind: "attachment",
    label: "Equipment layout renderings",
    detail:
      "Schematic or photographic renderings of the site's generalized layout as seen from two vantage points on the water, plus the locations of those two vantage points.",
  },
  OIL_SPILL_PLAN,
  FINANCIAL_LETTER,
  RIPARIAN_LIST,
  TAX_MAP,
  INTERTIDAL_PERMISSION,
  MUNICIPAL_CONSENT,
  {
    id: "acknowledgement_page",
    kind: "signature",
    label: "Acknowledgement and signature page",
    detail:
      "Every listed applicant completes and signs the acknowledgement page — reading DMR's laws and rules, the non-refundable fee, the USACE responsibility, the gear-stays-in-bounds condition, and site marking under Chapter 2.80. For a company, someone authorized to certify on its behalf signs.",
  },
];
