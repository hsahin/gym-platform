import type { NextRequest } from "next/server";
import { z } from "zod";
import type { SupportedPhoneCountryCode } from "@claimtech/i18n";
import { normalizeMembershipBillingCycleInput } from "@/lib/memberships";
import {
  requireMutationSecurity,
  runApiHandler,
} from "@/server/http/platform-api";
import { requireViewerFromRequest } from "@/server/http/claimtech-request";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

const importContractsSchema = z.object({
  defaultLocationId: z.string().min(1),
  csv: z.string().min(10),
  phoneCountry: z.string().trim().length(2).default("NL"),
});

function detectDelimiter(line: string) {
  return line.includes(";") ? ";" : ",";
}

function normalizeHeaderValue(value: string) {
  return value.trim().toLowerCase();
}

function parseContractsCsv(csv: string, defaultPhoneCountry: string) {
  const trimmed = csv.trim();
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("Voeg een header en minstens één contractregel toe.");
  }

  const delimiter = detectDelimiter(lines[0]!);
  const headers = lines[0]!.split(delimiter).map(normalizeHeaderValue);
  const indexByHeader = new Map(headers.map((header, index) => [header, index] as const));

  function getColumn(
    row: string[],
    aliases: string[],
    options?: { required?: boolean },
  ) {
    for (const alias of aliases) {
      const index = indexByHeader.get(alias);

      if (typeof index === "number") {
        return row[index]?.trim() ?? "";
      }
    }

    if (options?.required) {
      throw new Error(`Kolom ontbreekt: ${aliases[0]}`);
    }

    return "";
  }

  const phoneCountry = defaultPhoneCountry as SupportedPhoneCountryCode;

  return lines.slice(1).map((line, rowIndex) => {
    const columns = line.split(delimiter).map((column) => column.trim());
    const billingCycle = normalizeMembershipBillingCycleInput(
      getColumn(columns, ["contractduur", "duur", "billingcycle", "term"], {
        required: true,
      }),
    );

    if (!billingCycle) {
      throw new Error(`Onbekende contractduur op regel ${rowIndex + 2}.`);
    }

    const priceValue = Number(
      getColumn(columns, ["prijs", "pricemonthly", "price", "bedrag"], {
        required: true,
      }).replace(",", "."),
    );

    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      throw new Error(`Ongeldige prijs op regel ${rowIndex + 2}.`);
    }

    const statusValue = getColumn(columns, ["status"]).toLowerCase();
    const waiverValue = getColumn(columns, ["waiver", "waiverstatus"]).toLowerCase();

    return {
      fullName: getColumn(columns, ["naam", "fullname", "name"], { required: true }),
      email: getColumn(columns, ["email", "e-mail"], { required: true }),
      phone: getColumn(columns, ["telefoon", "phone", "mobiel"], { required: true }),
      phoneCountry,
      membershipName: getColumn(columns, ["contract", "membership", "membershipname", "plan"], {
        required: true,
      }),
      billingCycle,
      priceMonthly: priceValue,
      homeLocationName: getColumn(columns, ["vestiging", "locatie", "homelocation"]),
      status:
        statusValue === "trial"
          ? ("trial" as const)
          : statusValue === "paused"
            ? ("paused" as const)
            : ("active" as const),
      waiverStatus: waiverValue === "complete" ? ("complete" as const) : ("pending" as const),
      tags: getColumn(columns, ["tags"])
        .split("|")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
  });
}

export async function POST(request: NextRequest) {
  return runApiHandler(
    request,
    async () => {
      const viewer = await requireViewerFromRequest(request);
      const services = await getGymPlatformServices();
      requireMutationSecurity(request);
      const payload = importContractsSchema.parse(await request.json());

      return services.importContractsAndMembers(viewer.actor, viewer.tenantContext, {
        defaultLocationId: payload.defaultLocationId,
        rows: parseContractsCsv(payload.csv, payload.phoneCountry),
      });
    },
    { successStatus: 201 },
  );
}
