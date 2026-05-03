import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCT_TERMS, getProductTerm } from "@/lib/product-terms";

const rootDir = resolve(__dirname, "..", "..");

const ownerFacingRoots = [
  "src/app/page.tsx",
  "src/app/pricing",
  "src/components",
  "src/features",
  "src/lib/billing.ts",
  "src/lib/dashboard-experience.ts",
  "src/lib/dashboard-page-layout.ts",
  "src/lib/dashboard-pages.ts",
  "src/lib/functionality-search.ts",
  "src/lib/marketing-content.ts",
  "src/lib/platform-workbench-experience.ts",
  "src/lib/reservation-experience.ts",
] as const;

const bannedCopyPatterns = [
  { pattern: /\bmember portal\b/i, term: "ledenportaal" },
  { pattern: /\bmember flow\b/i, term: "ledenroute" },
  { pattern: /\bmember journeys?\b/i, term: "ledentrajecten" },
  { pattern: /\bmembership management\b/i, term: "leden en lidmaatschappen" },
  { pattern: /\bstaff management\b/i, term: "medewerkers" },
  { pattern: /\bstaff\b/i, term: "medewerker" },
  { pattern: /\bteam\b/i, term: "medewerkers" },
  { pattern: /\bteamlid\b/i, term: "medewerker" },
  { pattern: /\bteamleden?\b/i, term: "medewerker" },
  { pattern: /\bteamaccounts?\b/i, term: "medewerkeraccounts" },
  { pattern: /\bteamrollen?\b/i, term: "medewerkerrollen" },
  { pattern: /\bteambeheer\b/i, term: "medewerkers" },
  { pattern: /\bpersoneel\b/i, term: "medewerkers" },
  { pattern: /\bowner experience\b/i, term: "eigenaarservaring" },
  { pattern: /\bownerdashboard\b/i, term: "eigenaarsdashboard" },
  { pattern: /\bowners?\b/i, term: "eigenaar" },
  { pattern: /\btrial booking\b/i, term: "proefles" },
  { pattern: /\bTrial\b/, term: "Proeflid of proefles" },
  { pattern: /\bcredit packs?\b/i, term: "strippenkaart" },
  { pattern: /\bcredits\b/i, term: "ritten of strippenkaart" },
  { pattern: /\bdirect debit\b/i, term: "incasso" },
  { pattern: /\bone-time\b|\bone time\b/i, term: "eenmalige betaling" },
  { pattern: /\bpayment requests?\b/i, term: "betaalverzoek" },
  { pattern: /\blocations?\b/i, term: "vestiging" },
  { pattern: /\blocaties?\b/i, term: "vestiging" },
  { pattern: /\bmember state\b/i, term: "lidstatus" },
  { pattern: /\breadiness\b/i, term: "klaar om te starten" },
  { pattern: /\brolloutgroep\b/i, term: "beschikbaarheid" },
  { pattern: /\bruntimegezondheid\b/i, term: "systeemstatus" },
  { pattern: /\bfeature-uitrol\b/i, term: "modulebeheer" },
  { pattern: /\btenant flags\b/i, term: "clubmodules" },
  { pattern: /\bruntime[a-z-]*/i, term: "systeemstatus" },
  { pattern: /\brollout\b|\buitrolstatus\b|\bplatformuitrol\b/i, term: "modulebeschikbaarheid" },
  { pattern: /\bplatformchecks?\b/i, term: "statuschecks" },
  { pattern: /\bplatformstatus\b/i, term: "clubstatus" },
  { pattern: /\bplatformmodules\b/i, term: "clubmodules" },
] as const;

function listSourceFiles(inputPath: string): ReadonlyArray<string> {
  const absolutePath = resolve(rootDir, inputPath);
  const stat = statSync(absolutePath);

  if (stat.isFile()) {
    return [absolutePath];
  }

  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const childPath = resolve(absolutePath, entry.name);

    if (entry.isDirectory()) {
      return listSourceFiles(childPath.replace(`${rootDir}/`, ""));
    }

    if (
      !entry.isFile() ||
      entry.name.endsWith(".test.ts") ||
      entry.name.endsWith(".test.tsx") ||
      entry.name.endsWith(".spec.ts") ||
      entry.name.endsWith(".spec.tsx")
    ) {
      return [];
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [childPath] : [];
  });
}

function extractCopyStrings(source: string) {
  const strings: string[] = [];
  const stringPattern = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  const jsxTextPattern = />\s*([^<>{}\n][^<>{}]*)\s*</g;

  for (const match of source.matchAll(stringPattern)) {
    const value = match[2]?.replace(/\\n/g, " ").trim();

    if (
      value &&
      /[A-Za-zÀ-ÿ]/.test(value) &&
      !value.includes("${") &&
      !/[\/@]/.test(value) &&
      !/^[a-z0-9_.:-]+$/.test(value)
    ) {
      strings.push(value);
    }
  }

  for (const match of source.matchAll(jsxTextPattern)) {
    const value = match[1]?.replace(/\s+/g, " ").trim();

    if (
      value &&
      value.length < 160 &&
      /[A-Za-zÀ-ÿ]/.test(value) &&
      !/[;=[\]{}]/.test(value) &&
      !/\b(const|return|snapshot|useState)\b/.test(value)
    ) {
      strings.push(value);
    }
  }

  return strings;
}

describe("product terms", () => {
  it("defines the fixed owner-facing glossary", () => {
    expect(PRODUCT_TERMS).toMatchObject({
      members: "leden",
      memberships: "lidmaatschappen",
      trialClass: "proefles",
      directDebit: "incasso",
      oneTimePayment: "eenmalige betaling",
      paymentRequest: "betaalverzoek",
      location: "vestiging",
      creditPack: "strippenkaart",
      staffMember: "medewerker",
      owner: "eigenaar",
    });
    expect(getProductTerm("staffMembers")).toBe("medewerkers");
  });

  it("keeps owner-facing copy on the fixed glossary", () => {
    const files = ownerFacingRoots.flatMap(listSourceFiles);
    const violations = files.flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      const copyStrings = extractCopyStrings(source);

      return copyStrings.flatMap((copy) =>
        bannedCopyPatterns
          .filter(({ pattern }) => pattern.test(copy))
          .map(({ pattern, term }) => ({
            file: filePath.replace(`${rootDir}/`, ""),
            copy,
            pattern: String(pattern),
            term,
          })),
      );
    });

    expect(violations).toEqual([]);
  });
});
