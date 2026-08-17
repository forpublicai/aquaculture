/**
 * The parts of an LPA application this app cannot produce.
 *
 * A chatbot can write down your gear inventory. It cannot draw a cross-section,
 * obtain a harbormaster's signature, or mail anything by certified post. The
 * memo's whole framing is that the applicant should never be surprised at the
 * end by work they didn't know they owed — so these are modeled explicitly,
 * shown alongside the answered questions, and tracked with their own status.
 *
 * Which of them apply is derived from the applicant's own answers, so a site in
 * a lobster pound never sees the riparian mailing requirements, and a town
 * without a harbormaster is asked for a municipal officer's signature instead.
 *
 * Statuses live in `application.externalRequirements` keyed by `id`; a missing
 * key means "not_started". Nothing here is ever set by the model.
 */
import { isShallowOrIntertidal, riparianNotificationRequired } from "./fields";
import type { LpaApplication, RequirementStatus } from "./schema";

export type RequirementKind = "attachment" | "signature" | "payment" | "external_permit";

export interface RequirementDef {
  id: string;
  kind: RequirementKind;
  label: string;
  /** What the applicant actually has to do, in plain terms. */
  detail: string;
  appliesWhen?: (app: LpaApplication) => boolean;
}

export const LPA_REQUIREMENTS: RequirementDef[] = [
  {
    id: "application_fee",
    kind: "payment",
    label: "Application fee",
    detail:
      "$100 for Maine residents, $400 for non-residents, non-refundable. Include a check payable to \"Treasurer, State of Maine\" with the application, or ask DMR for card payment instructions. Never mail card details. DMR won't review the application until payment arrives.",
  },
  {
    id: "vicinity_map",
    kind: "attachment",
    label: "Vicinity map",
    detail:
      "An enlarged NOAA chart or USGS topographic map showing the site, 300-foot and 1,000-foot radius circles, gear orientation, a north arrow, depth contours with MLW and MHW marked, ebb and flood directions, the scale used, the DMR water quality classification area, and the distance to any prohibited area.",
  },
  {
    id: "overhead_view",
    kind: "attachment",
    label: "Overhead view of gear",
    detail:
      "An overhead drawing on 8.5x11 paper showing the maximum gear layout, labeled with unit counts, dimensions and materials, demonstrating that the gear plus the space between it stays under 400 square feet. One drawing per configuration, including seasonal changes. No color shading, since it won't photocopy.",
  },
  {
    id: "cross_section_view",
    kind: "attachment",
    label: "Cross-section view of gear",
    detail:
      "A side-on drawing showing the sea bottom, mean high and low water marks, and gear profiles as deployed, with mooring type, scope, hardware, and line type and size labeled. One per configuration, including seasonal changes.",
  },
  {
    id: "harbormaster_signature",
    kind: "signature",
    label: "Harbormaster signature",
    detail:
      "The harbormaster signs to confirm the site won't unreasonably interfere with navigation, riparian ingress and egress, or fishing and other uses. If the signature is withheld, say so on the form and include a statement of which signatures were denied, the date you tried, and a request that DMR review the basis. Leaving that out means automatic denial and loss of fees.",
    appliesWhen: (app) => app.municipalityHasHarbormaster !== false,
  },
  {
    id: "municipal_officer_signature",
    kind: "signature",
    label: "Municipal officer signature",
    detail:
      "In a municipality without a harbormaster, a selectman, councilor, alderman, mayor or other elected municipal official signs instead. In unorganized territory, a marine patrol officer may sign.",
    appliesWhen: (app) => app.municipalityHasHarbormaster === false,
  },
  {
    id: "marina_or_pound_owner_consent",
    kind: "signature",
    label: "Marina or pound owner consent",
    detail:
      "The owner (or their authorized representative) of the marina slip, lobster pound or similar area signs to consent to aquaculture gear being placed there.",
    appliesWhen: (app) => app.isMarinaOrPoundSite === true,
  },
  {
    id: "riparian_landowner_consent",
    kind: "signature",
    label: "Riparian landowner consent",
    detail:
      "For sites above mean low water, the owner of the adjacent upland and intertidal land signs to consent to gear being placed on their intertidal land.",
    appliesWhen: (app) => app.isAboveMeanLowWater === true,
  },
  {
    id: "municipal_shellfish_signature",
    kind: "signature",
    label: "Municipal shellfish program signature",
    detail:
      "If the town has a municipal shellfish management program under 12 M.R.S.A. §6671, the committee chairperson or designated town officer signs to verify the LPA won't unreasonably interfere with the program. If the town has a program but no committee, a municipal official signs. Check with the town if you're unsure whether a program exists.",
    appliesWhen: isShallowOrIntertidal,
  },
  {
    id: "tax_map",
    kind: "attachment",
    label: "Municipal tax map",
    detail:
      "A copy of the municipal tax map covering the area, with the center point of the site marked and a 300-foot radius drawn if the map has an accurate scale. In unorganized territory, request the shorefront property list from Maine Revenue Services, Property Tax Division.",
    appliesWhen: riparianNotificationRequired,
  },
  {
    id: "certified_riparian_list",
    kind: "attachment",
    label: "Certified riparian landowner list",
    detail:
      "The riparian list, certified by the municipal clerk or tax collector, covering every shorefront parcel within 300 feet including land down to mean low water. An incomplete list means denial and forfeited fees.",
    appliesWhen: riparianNotificationRequired,
  },
  {
    id: "certified_mail_receipts",
    kind: "attachment",
    label: "Certified mail receipts",
    detail:
      "Send a copy of the completed application plus the \"Notice to Riparian Landowners\" page by certified mail to every landowner on the list, then attach the receipts. Each receipt must have the name and address filled in.",
    appliesWhen: riparianNotificationRequired,
  },
  {
    id: "applicant_signature",
    kind: "signature",
    label: "Applicant signature",
    detail:
      "You sign to declare the information is true and correct, that you'll comply with DMR laws and rules, and that Marine Patrol may inspect the site under 12 M.R.S. §6306. A false statement is grounds for revocation.",
  },
  {
    id: "army_corps_permit",
    kind: "external_permit",
    label: "Army Corps of Engineers permit",
    detail:
      "A separate federal permit is required before any gear goes in the water. The federal review runs independently of DMR's. There's no fee. Contact cenae-r-me@usace.army.mil or (207) 623-8367.",
  },
];

export interface RequirementState extends RequirementDef {
  status: RequirementStatus;
}

/** The requirements that apply to this application, with their current status. */
export function applicableRequirements(app: LpaApplication): RequirementState[] {
  return LPA_REQUIREMENTS.filter((req) => (req.appliesWhen ? req.appliesWhen(app) : true)).map(
    (req) => ({ ...req, status: app.externalRequirements?.[req.id] ?? "not_started" })
  );
}

/** Requirements the applicant still owes — i.e. not done and not waived. */
export function outstandingRequirements(app: LpaApplication): RequirementState[] {
  return applicableRequirements(app).filter(
    (req) => req.status !== "done" && req.status !== "not_applicable"
  );
}
