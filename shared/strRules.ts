export type StrRuleResult = {
  city: string;
  rules: { text: string; url?: string }[];
  source: string;
  sourceUrl: string;
  lastVerified: string;
};

const RULES: Record<string, StrRuleResult> = {
  toronto: {
    city: "Toronto",
    rules: [
      {
        text: "Short-term rentals must be in your principal residence — you must live there",
      },
      { text: "Maximum 180 nights per year for entire-home rentals" },
      { text: "A short-term rental licence is required ($50/year)" },
      {
        text: "Platforms (Airbnb, VRBO) must also be licensed to list Toronto properties",
      },
    ],
    source: "City of Toronto Municipal Code · Chapter 547",
    sourceUrl:
      "https://www.toronto.ca/community-people/housing-shelter/rental-housing-tenant-information/short-term-rentals/",
    lastVerified: "November 2026",
  },
  mississauga: {
    city: "Mississauga",
    rules: [
      {
        text: "Short-term rentals require a City of Mississauga business licence ($120/year)",
      },
      { text: "Must be your principal residence" },
      { text: "Maximum 3 rooms or entire unit permitted" },
      { text: "Zoning approval required before listing" },
    ],
    source: "City of Mississauga Business Licence By-law",
    sourceUrl:
      "https://www.mississauga.ca/en/city-government/bylaws/business-licensing.aspx",
    lastVerified: "November 2026",
  },
  brampton: {
    city: "Brampton",
    rules: [
      {
        text: "Short-term rentals are not currently permitted under Brampton's zoning by-laws",
      },
      {
        text: "The City is reviewing STR regulations — rules may change",
      },
      { text: "Recommend confirming with the City before listing" },
    ],
    source: "City of Brampton Zoning By-law",
    sourceUrl:
      "https://www.brampton.ca/EN/residents/Planning/ZoningBylaw/Pages/Welcome.aspx",
    lastVerified: "November 2026",
  },
  vaughan: {
    city: "Vaughan",
    rules: [
      { text: "Short-term rentals permitted in principal residences only" },
      { text: "A City of Vaughan business licence is required" },
      { text: "Maximum 3 rooms may be rented at once" },
    ],
    source: "City of Vaughan",
    sourceUrl:
      "https://www.vaughan.ca/business/licences_and_permits/Pages/default.aspx",
    lastVerified: "November 2026",
  },
  markham: {
    city: "Markham",
    rules: [
      { text: "Short-term rentals require a permit under Markham's STR by-law" },
      { text: "Must be your principal residence" },
      { text: "Maximum 180 nights per year" },
    ],
    source: "City of Markham STR By-law",
    sourceUrl:
      "https://www.markham.ca/wps/portal/engsite/main/residents/property-and-environment/short-term-rentals",
    lastVerified: "November 2026",
  },
  "richmond hill": {
    city: "Richmond Hill",
    rules: [
      {
        text: "Short-term rentals require registration with the Town of Richmond Hill",
      },
      { text: "Must be your principal residence" },
      { text: "Maximum 180 nights per year for entire-home rentals" },
    ],
    source: "Town of Richmond Hill STR By-law",
    sourceUrl: "https://www.richmondhill.ca/en/business/short-term-rentals.aspx",
    lastVerified: "November 2026",
  },
  oakville: {
    city: "Oakville",
    rules: [
      {
        text: "Short-term rentals require a Town of Oakville licence ($350/year)",
      },
      { text: "Must be your principal residence" },
      { text: "Entire-home rentals permitted with licence" },
    ],
    source: "Town of Oakville Short-Term Rental Licensing By-law",
    sourceUrl:
      "https://www.oakville.ca/business/licences-permits/short-term-rental-licence.html",
    lastVerified: "November 2026",
  },
  pickering: {
    city: "Pickering",
    rules: [
      {
        text: "Short-term rental regulations are currently under review in Pickering",
      },
      { text: "No formal STR licence required at this time" },
      {
        text: "Recommend confirming with the City before listing as rules may change",
      },
    ],
    source: "City of Pickering",
    sourceUrl: "https://www.pickering.ca",
    lastVerified: "November 2026",
  },
  ajax: {
    city: "Ajax",
    rules: [
      {
        text: "No formal short-term rental by-law in effect at this time",
      },
      {
        text: "Standard zoning rules apply — check with the municipality before listing",
      },
    ],
    source: "Durham Region municipalities",
    sourceUrl: "https://www.durham.ca",
    lastVerified: "November 2026",
  },
  whitby: {
    city: "Whitby",
    rules: [
      {
        text: "No formal short-term rental by-law in effect at this time",
      },
      {
        text: "Standard zoning rules apply — check with the municipality before listing",
      },
    ],
    source: "Durham Region municipalities",
    sourceUrl: "https://www.durham.ca",
    lastVerified: "November 2026",
  },
  oshawa: {
    city: "Oshawa",
    rules: [
      {
        text: "No formal short-term rental by-law in effect at this time",
      },
      {
        text: "Standard zoning rules apply — check with the municipality before listing",
      },
    ],
    source: "Durham Region municipalities",
    sourceUrl: "https://www.durham.ca",
    lastVerified: "November 2026",
  },
};

/** Case-insensitive city lookup. Returns null when the city is not on file. */
export function getStrRules(city: string): StrRuleResult | null {
  const key = city.trim().toLowerCase();
  if (!key) return null;
  return RULES[key] ?? null;
}
