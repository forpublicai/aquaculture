"""Structured data models for the license triage interview."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class LicenseType(str, Enum):
    LIMITED_PURPOSE_AQUACULTURE = "Limited Purpose Aquaculture (LPA) License"
    EXPERIMENTAL_LEASE = "Experimental Lease"
    STANDARD_LEASE = "Standard Lease"
    UNDETERMINED = "Undetermined — more information needed"


class OperationProfile(BaseModel):
    """Fields extracted from the applicant's natural-language description
    of their (prospective) operation. All fields are optional individually
    since they're filled in incrementally over the conversation — see
    `REQUIRED_FIELDS` in rules.py for what's needed before routing."""

    species: Optional[list[str]] = Field(
        default=None,
        description="Species to be cultivated, e.g. ['oysters'], ['kelp', 'mussels'].",
    )
    gear_type: Optional[str] = Field(
        default=None,
        description=(
            "Cultivation method/gear, e.g. 'suspended cages', 'bottom culture', "
            "'floating rafts', 'longlines'."
        ),
    )
    site_area_sq_ft: Optional[float] = Field(
        default=None,
        description="Proposed site area in square feet. Convert acres to sq ft if given (1 acre = 43,560 sq ft).",
    )
    lease_duration_years: Optional[int] = Field(
        default=None,
        description="Desired lease term in years.",
    )
    is_first_time_applicant: Optional[bool] = Field(
        default=None,
        description="Whether this is the applicant's first Maine aquaculture license.",
    )
    wants_to_test_before_committing: Optional[bool] = Field(
        default=None,
        description=(
            "Whether the applicant wants to trial a new site, species, or "
            "technique before committing to a long-term lease."
        ),
    )
    location_description: Optional[str] = Field(
        default=None,
        description="Free-text description of the proposed site location.",
    )


class RoutingResult(BaseModel):
    license_type: LicenseType
    rationale: str
    missing_fields: list[str] = Field(default_factory=list)
    incompatibility_warning: Optional[str] = None
