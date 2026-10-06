import { z } from "zod";

export const legalNavigatorInputSchema = z.object({
  question: z.string().trim().min(3, "Tell Truth Weaver what you are trying to understand.").max(1200),
  place: z.string().trim().min(2, "Add the place or jurisdiction.").max(220),
  eventDate: z.string().trim().max(40).optional().default(""),
  asOfDate: z.string().trim().max(40).optional().default(""),
  facts: z.string().trim().max(12_000).optional().default(""),
  predecessorFingerprint: z.union([z.literal(""), z.string().regex(/^[a-f0-9]{64}$/)]).optional().default(""),
});

export type LegalNavigatorInput = z.infer<typeof legalNavigatorInputSchema>;

export type JurisdictionResolution = {
  status: "RESOLVED" | "PARTIAL" | "JURISDICTION UNKNOWN";
  layers: string[];
  allowedDomains: string[];
  missing: string[];
};

const CONTINENT_ONLY = /^(africa|asia|europe|north america|south america|antarctica|australia|oceania)$/i;

export const OFFICIAL_SOURCE_REGISTRY = [
  {
    domain: "uscode.house.gov",
    jurisdiction: "United States (Federal)",
    sourceType: "statute_code",
    sourceRole: "primary",
    issuingBody: "Office of the Law Revision Counsel, U.S. House of Representatives",
    currentText: true,
  },
  {
    domain: "ecfr.gov",
    jurisdiction: "United States (Federal)",
    sourceType: "regulation",
    sourceRole: "primary",
    issuingBody: "Office of the Federal Register / U.S. Government Publishing Office",
    currentText: true,
  },
  {
    domain: "govinfo.gov",
    jurisdiction: "United States (Federal)",
    sourceType: "jurisdiction_defined_authority",
    sourceRole: "primary",
    issuingBody: "U.S. Government Publishing Office",
    currentText: false,
  },
  {
    domain: "supremecourt.gov",
    jurisdiction: "United States (Federal)",
    sourceType: "judicial_decision",
    sourceRole: "primary",
    issuingBody: "Supreme Court of the United States",
    currentText: false,
  },
  {
    domain: "legis.state.pa.us",
    jurisdiction: "Pennsylvania",
    sourceType: "statute_code",
    sourceRole: "primary",
    issuingBody: "Pennsylvania General Assembly",
    currentText: true,
  },
  {
    domain: "pacodeandbulletin.gov",
    jurisdiction: "Pennsylvania",
    sourceType: "regulation",
    sourceRole: "primary",
    issuingBody: "Commonwealth of Pennsylvania",
    currentText: true,
  },
  {
    domain: "pacourts.us",
    jurisdiction: "Pennsylvania",
    sourceType: "judicial_decision",
    sourceRole: "primary",
    issuingBody: "Unified Judicial System of Pennsylvania",
    currentText: false,
  },
  {
    domain: "phila.gov",
    jurisdiction: "Philadelphia",
    sourceType: "jurisdiction_defined_authority",
    sourceRole: "discovery",
    issuingBody: "City of Philadelphia",
    currentText: false,
  },
  {
    domain: "legislation.gov.uk",
    jurisdiction: "United Kingdom",
    sourceType: "statute_code",
    sourceRole: "primary",
    issuingBody: "The National Archives",
    currentText: true,
  },
  {
    domain: "supremecourt.uk",
    jurisdiction: "United Kingdom",
    sourceType: "judicial_decision",
    sourceRole: "primary",
    issuingBody: "Supreme Court of the United Kingdom",
    currentText: false,
  },
  {
    domain: "laws-lois.justice.gc.ca",
    jurisdiction: "Canada",
    sourceType: "statute_code",
    sourceRole: "primary",
    issuingBody: "Department of Justice Canada",
    currentText: true,
  },
  {
    domain: "decisions.scc-csc.ca",
    jurisdiction: "Canada",
    sourceType: "judicial_decision",
    sourceRole: "primary",
    issuingBody: "Supreme Court of Canada",
    currentText: false,
  },
  {
    domain: "eur-lex.europa.eu",
    jurisdiction: "European Union",
    sourceType: "jurisdiction_defined_authority",
    sourceRole: "primary",
    issuingBody: "European Union",
    currentText: true,
  },
  {
    domain: "curia.europa.eu",
    jurisdiction: "European Union",
    sourceType: "judicial_decision",
    sourceRole: "primary",
    issuingBody: "Court of Justice of the European Union",
    currentText: false,
  },
  {
    domain: "justice.gov.ng",
    jurisdiction: "Nigeria",
    sourceType: "jurisdiction_defined_authority",
    sourceRole: "discovery",
    issuingBody: "Federal Ministry of Justice, Nigeria",
    currentText: false,
  },
  {
    domain: "nass.gov.ng",
    jurisdiction: "Nigeria",
    sourceType: "enacted_act",
    sourceRole: "discovery",
    issuingBody: "National Assembly of the Federal Republic of Nigeria",
    currentText: false,
  },
  {
    domain: "ratchakitcha.soc.go.th",
    jurisdiction: "Thailand",
    sourceType: "gazette",
    sourceRole: "primary",
    issuingBody: "Royal Thai Government Gazette",
    currentText: false,
  },
  {
    domain: "krisdika.go.th",
    jurisdiction: "Thailand",
    sourceType: "statute_code",
    sourceRole: "discovery",
    issuingBody: "Office of the Council of State, Thailand",
    currentText: false,
  },
] as const;

function domainsFor(...jurisdictions: string[]) {
  return OFFICIAL_SOURCE_REGISTRY
    .filter((source) => jurisdictions.includes(source.jurisdiction))
    .map((source) => source.domain);
}

export function resolveJurisdictionHint(placeRaw: string): JurisdictionResolution {
  const place = placeRaw.trim();
  if (!place || CONTINENT_ONLY.test(place)) {
    return {
      status: "JURISDICTION UNKNOWN",
      layers: [],
      allowedDomains: [],
      missing: [
        place
          ? place + " is too broad to identify governing law. Add a country and, when relevant, a state/province/region and city/local authority."
          : "Add the country and any relevant state/province/region or city/local authority.",
      ],
    };
  }

  if (/philadelphia/i.test(place)) {
    const layers = ["United States (Federal)", "Pennsylvania", "Philadelphia"];
    return { status: "RESOLVED", layers, allowedDomains: domainsFor(...layers), missing: [] };
  }

  if (/pennsylvania|\bpa\b/i.test(place)) {
    const layers = ["United States (Federal)", "Pennsylvania"];
    return {
      status: "PARTIAL",
      layers,
      allowedDomains: domainsFor(...layers),
      missing: ["A county or municipality may also matter depending on the legal issue."],
    };
  }

  if (/united states|\bu\.?s\.?\b|federal/i.test(place)) {
    const layers = ["United States (Federal)"];
    return {
      status: "PARTIAL",
      layers,
      allowedDomains: domainsFor(...layers),
      missing: ["State, territory, tribal, county, or municipal law may also control depending on the issue."],
    };
  }

  if (/nigeria/i.test(place)) {
    const layers = ["Nigeria"];
    return {
      status: "PARTIAL",
      layers,
      allowedDomains: domainsFor(...layers),
      missing: ["Nigeria state and local law may matter. Add the state or territory when the issue is not purely federal."],
    };
  }

  if (/thailand/i.test(place)) {
    const layers = ["Thailand"];
    return { status: "RESOLVED", layers, allowedDomains: domainsFor(...layers), missing: [] };
  }

  if (/canada/i.test(place)) {
    const layers = ["Canada"];
    return {
      status: "PARTIAL",
      layers,
      allowedDomains: domainsFor(...layers),
      missing: ["Province or territory may matter for the issue."],
    };
  }

  if (/united kingdom|\buk\b|england|wales|scotland|northern ireland/i.test(place)) {
    const layers = ["United Kingdom"];
    return {
      status: "PARTIAL",
      layers,
      allowedDomains: domainsFor(...layers),
      missing: ["Specify England and Wales, Scotland, or Northern Ireland when the legal system differs for the issue."],
    };
  }

  if (/european union|\beu\b/i.test(place)) {
    const layers = ["European Union"];
    return {
      status: "PARTIAL",
      layers,
      allowedDomains: domainsFor(...layers),
      missing: ["Member-state law may also apply. Add the country when relevant."],
    };
  }

  return {
    status: "JURISDICTION UNKNOWN",
    layers: [place],
    allowedDomains: [],
    missing: ["No verified official-source adapter is registered for this place yet. Truth Weaver must not guess the governing law."],
  };
}

export function sourceRegistryForUrl(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return (
      OFFICIAL_SOURCE_REGISTRY.find(
        (entry) => hostname === entry.domain || hostname.endsWith("." + entry.domain),
      ) ?? null
    );
  } catch {
    return null;
  }
}

const modelFindingSchema = z
  .object({
    proposition: z.string().trim().min(1).max(900),
    explanation: z.string().trim().min(1).max(2400),
    citation: z.string().trim().max(300).nullable(),
    authorityType: z.string().trim().max(160),
    issuingBody: z.string().trim().max(220).nullable(),
    sourceUrls: z.array(z.string().url()).max(8),
    effectiveDate: z.string().trim().max(120).nullable(),
    currentnessNote: z.string().trim().max(700).nullable(),
    contraryAuthority: z.string().trim().max(900).nullable(),
  })
  .strict();

export const legalNavigatorModelOutputSchema = z
  .object({
    jurisdictionSummary: z.string().trim().min(1).max(1200),
    issues: z.array(z.string().trim().min(1).max(500)).max(12),
    findings: z.array(modelFindingSchema).max(12),
    missingFacts: z.array(z.string().trim().min(1).max(500)).max(16),
    procedureAndDeadlines: z.array(z.string().trim().min(1).max(700)).max(16),
    options: z.array(z.string().trim().min(1).max(700)).max(16),
    nextResearch: z.array(z.string().trim().min(1).max(700)).max(16),
  })
  .strict();

export type LegalNavigatorModelOutput = z.infer<typeof legalNavigatorModelOutputSchema>;

export function parseLegalNavigatorModelText(text: string): LegalNavigatorModelOutput {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Research response did not contain a JSON object.");
  return legalNavigatorModelOutputSchema.parse(JSON.parse(trimmed.slice(start, end + 1)));
}

export function historicalVersionRequired(input: LegalNavigatorInput, now = new Date()): boolean {
  if (!input.eventDate) return false;
  const event = new Date(input.eventDate + (input.eventDate.length === 10 ? "T00:00:00Z" : ""));
  if (Number.isNaN(event.getTime())) return true;
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;
  return now.getTime() - event.getTime() > ninetyDays;
}
