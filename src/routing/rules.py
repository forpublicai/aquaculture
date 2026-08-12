"""Deterministic license-type routing rules.

Thresholds below reflect general, publicly available guidance on Maine DMR
aquaculture license categories (LPA vs. Experimental vs. Standard leases) as
of this writing. DMR rules and size/term limits are subject to change —
treat routing output as a *preliminary* recommendation, not a final
determination, and confirm current requirements against DMR's own
documentation (see the Regulatory Q&A feature) or the Department directly.
"""

from src.routing.schema import LicenseType, OperationProfile, RoutingResult

SQ_FT_PER_ACRE = 43_560

LPA_MAX_AREA_SQ_FT = 400
EXPERIMENTAL_MAX_AREA_SQ_FT = 4 * SQ_FT_PER_ACRE
EXPERIMENTAL_MAX_DURATION_YEARS = 3
STANDARD_LEASE_MAX_DURATION_YEARS = 20

REQUIRED_FIELDS = ["species", "gear_type", "site_area_sq_ft", "lease_duration_years"]

FIELD_PROMPTS = {
    "species": "which species you plan to cultivate (e.g. oysters, mussels, kelp)",
    "gear_type": "what gear or cultivation method you'll use (e.g. suspended cages, bottom culture, floating rafts)",
    "site_area_sq_ft": "roughly how large the proposed site is (in square feet or acres)",
    "lease_duration_years": "how long a lease term you're looking for",
}


def missing_required_fields(profile: OperationProfile) -> list[str]:
    missing = []
    for field in REQUIRED_FIELDS:
        value = getattr(profile, field)
        if value is None or value == []:
            missing.append(field)
    return missing


def route(profile: OperationProfile) -> RoutingResult:
    missing = missing_required_fields(profile)
    if missing:
        return RoutingResult(
            license_type=LicenseType.UNDETERMINED,
            rationale="Not enough information yet to recommend a license type.",
            missing_fields=missing,
        )

    area = profile.site_area_sq_ft
    duration = profile.lease_duration_years
    wants_trial = bool(profile.wants_to_test_before_committing)

    incompatibility_warning = None
    if duration > STANDARD_LEASE_MAX_DURATION_YEARS:
        incompatibility_warning = (
            f"A {duration}-year term exceeds the typical {STANDARD_LEASE_MAX_DURATION_YEARS}-year "
            "maximum for a Maine DMR standard aquaculture lease — confirm the current maximum "
            "term with DMR before applying."
        )

    if area <= LPA_MAX_AREA_SQ_FT and not wants_trial:
        return RoutingResult(
            license_type=LicenseType.LIMITED_PURPOSE_AQUACULTURE,
            rationale=(
                f"A site of {area:.0f} sq ft falls within the LPA size threshold "
                f"({LPA_MAX_AREA_SQ_FT} sq ft), and this isn't described as a trial run. "
                "LPA licenses are lower-cost, faster to obtain, and renewed annually, but "
                "are capped in size and don't require the riparian-owner notification and "
                "public-hearing process a lease does."
            ),
            incompatibility_warning=incompatibility_warning,
        )

    if area <= EXPERIMENTAL_MAX_AREA_SQ_FT and (
        wants_trial or duration <= EXPERIMENTAL_MAX_DURATION_YEARS
    ):
        return RoutingResult(
            license_type=LicenseType.EXPERIMENTAL_LEASE,
            rationale=(
                f"A site of {area:.0f} sq ft is within the experimental lease size threshold "
                f"({EXPERIMENTAL_MAX_AREA_SQ_FT:.0f} sq ft / 4 acres), and "
                + (
                    "you've described this as testing a site, species, or technique before committing long-term."
                    if wants_trial
                    else f"a {duration}-year term fits an experimental lease's shorter horizon."
                )
                + " Experimental leases are meant for exactly this kind of trial before "
                "committing to a standard lease."
            ),
            incompatibility_warning=incompatibility_warning,
        )

    return RoutingResult(
        license_type=LicenseType.STANDARD_LEASE,
        rationale=(
            f"A site of {area:.0f} sq ft and a {duration}-year term exceed the LPA and "
            "experimental lease thresholds, which points to a standard aquaculture lease — "
            "Maine's long-term license for established commercial-scale operations. This is "
            "the most involved application: expect riparian landowner notification, a tax "
            "map, and a public scoping process."
        ),
        incompatibility_warning=incompatibility_warning,
    )
