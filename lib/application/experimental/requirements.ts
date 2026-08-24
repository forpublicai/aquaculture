/**
 * The parts of an Experimental lease application this app cannot produce.
 *
 * Drawn from the form's sections 11 and 12 (renderings, attachments, and the
 * acknowledgement page) plus the cover pages (fee, USACE copy). Which of them
 * apply is derived from the applicant's own answers, so a bottom-planting site
 * with no gear never sees the gear schematics, and a site clear of shorefront
 * never sees the riparian list.
 *
 * Statuses live in `application.externalRequirements` keyed by `id`; a missing
 * key means "not_started". Nothing here is ever set by the model.
 */
import type { RequirementDef } from "../definition";

import { proposesFloatingStructure, proposesGear } from "./fields";
import type { ExperimentalApplication } from "./schema";

const gearProposed = (app: ExperimentalApplication) => proposesGear(app);
const seasonal = (app: ExperimentalApplication) =>
  proposesGear(app) && app.hasSeasonalGearChanges === true;

export const EXPERIMENTAL_REQUIREMENTS: RequirementDef[] = [
  {
    id: "application_fee",
    kind: "payment",
    label: "Application fee",
    detail:
      "$750, non-refundable. Paying by check means mailing the application with the check, payable to \"Treasurer State of Maine\". Paying by card, you may mail or email the application and DMR will contact you for payment; never include card details. DMR doesn't review the application until payment arrives.",
  },
  {
    id: "usace_copy",
    kind: "external_permit",
    label: "Copy to the Army Corps of Engineers",
    detail:
      "This form doubles as the USACE permit application, but you must send them their own copy — by email to Cenae-r-me@usace.army.mil or by mail to the Maine Project Office in Augusta — and manage their process yourself. Their review runs separately from DMR's.",
  },
  {
    id: "boundary_drawing",
    kind: "attachment",
    label: "Boundary drawing",
    detail:
      "A rendering labeled 'Boundary Drawing' showing the site's boundaries, with every corner labeled to match the coordinate table: corner 1 at the NW, proceeding clockwise.",
  },
  {
    id: "vicinity_map",
    kind: "attachment",
    label: "Vicinity map",
    detail:
      "A NOAA chart labeled 'Vicinity Map' showing at least 3,000 feet around the site, with the lease boundaries, a 1,000-foot buffer around each corner, an arrow indicating true north, and a scale bar.",
  },
  {
    id: "overhead_view",
    kind: "attachment",
    label: "Overhead view of gear",
    detail:
      "A rendering labeled 'Overhead View' with the maximum layout of all gear including moorings, each gear type labeled, floats and structures placed, approximate spacing in feet, the site's length and width, the boundaries with corner markers, and gear orientation.",
    appliesWhen: gearProposed,
  },
  {
    id: "seasonal_overhead_view",
    kind: "attachment",
    label: "Seasonal overhead view",
    detail:
      "Because gear deployment changes seasonally, a second overhead view labeled 'Seasonal Overhead View' showing the seasonal layout, with the same labeling as the main one.",
    appliesWhen: seasonal,
  },
  {
    id: "cross_section_view",
    kind: "attachment",
    label: "Cross section view of gear",
    detail:
      "A rendering labeled 'Cross Section View': the gear in profile as deployed, each type labeled, with mooring type, scope, hardware, and line type and size, and the gear's depth relative to the surface at both mean low and mean high water.",
    appliesWhen: gearProposed,
  },
  {
    id: "seasonal_cross_section_view",
    kind: "attachment",
    label: "Seasonal cross section view",
    detail:
      "A matching 'Seasonal Cross Section View' for the seasonal gear layout.",
    appliesWhen: seasonal,
  },
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
  {
    id: "oil_spill_plan",
    kind: "attachment",
    label: "Oil spill prevention and control plan",
    detail:
      "Because petroleum products are stored on the site: procedures and control measures to prevent spills, and measures to contain, clean up, and mitigate a spill reaching navigable waters or shorelines.",
    appliesWhen: (app: ExperimentalApplication) => app.storesPetroleumOnSite === true,
  },
  {
    id: "financial_institution_letter",
    kind: "attachment",
    label: "Financial institution letter",
    detail:
      "A letter from a financial institution confirming you hold an account in good standing. Every listed applicant submits their own letter.",
  },
  {
    id: "riparian_list_certified",
    kind: "attachment",
    label: "Certified riparian landowner list",
    detail:
      "The riparian landowner list for every shorefront parcel within 1,000 feet, certified by the municipality — typically the town clerk or tax assessor. A site in more than one municipality needs a separate certified list per town.",
    appliesWhen: (app: ExperimentalApplication) => app.isWithin1000FtOfShorefront === true,
  },
  {
    id: "tax_map",
    kind: "attachment",
    label: "Municipal tax map",
    detail:
      "A tax map showing the town name, clearly numbered parcels, a legible scale, and the boundaries of the proposed lease site.",
    appliesWhen: (app: ExperimentalApplication) => app.isWithin1000FtOfShorefront === true,
  },
  {
    id: "intertidal_landowner_permission",
    kind: "signature",
    label: "Intertidal landowners' written permission",
    detail:
      "Because part of the site is above mean low water: written permission from every riparian owner whose intertidal land you'd use, naming the parcel's map and lot number to match the riparian list, naming every owner of the parcel, and stating plainly that they permit your aquaculture use. A general letter of support doesn't count. If you own the land yourself, an Applicant Statement with the map and lot number stands in. DMR won't accept the application without this.",
    appliesWhen: (app: ExperimentalApplication) => app.isAboveMeanLowWater === true,
  },
  {
    id: "municipal_intertidal_consent",
    kind: "attachment",
    label: "Municipal vote on intertidal use",
    detail:
      "Because the town has a shellfish conservation program: a majority of municipal officials must vote at a public meeting to permit your use of the intertidal area. Submit the final meeting minutes with the motion's text and the vote, or a letter summarizing the meeting with the date, the motion, each official's vote by name, and the signature of whoever submits it. Draft minutes aren't accepted.",
    appliesWhen: (app: ExperimentalApplication) =>
      app.isAboveMeanLowWater === true && app.municipalityHasShellfishProgram === true,
  },
  {
    id: "acknowledgement_page",
    kind: "signature",
    label: "Acknowledgement and signature page",
    detail:
      "Every listed applicant completes and signs the acknowledgement page — reading DMR's laws and rules, the non-refundable fee, the USACE responsibility, the gear-stays-in-bounds condition, and site marking under Chapter 2.80. For a company, someone authorized to certify on its behalf signs.",
  },
];
