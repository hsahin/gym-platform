"use client";

import {
  useEffect,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge, Button, PhoneNumberField } from "@claimtech/ui";
import { getDashboardExperience } from "@/lib/dashboard-experience";
import {
  CONTRACT_IMPORT_REQUIRED_CSV_HEADER,
  MEMBERSHIP_BILLING_CYCLE_OPTIONS,
} from "@/lib/memberships";
import { getPlatformWorkbenchExperience } from "@/lib/platform-workbench-experience";
import {
  BILLING_PAYMENT_METHOD_OPTIONS,
  BILLING_PROVIDER_OPTIONS,
} from "@/lib/billing";
import {
  REMOTE_ACCESS_BRIDGE_OPTIONS,
  REMOTE_ACCESS_PROVIDER_OPTIONS,
} from "@/lib/remote-access";
import { MUTATION_CSRF_TOKEN } from "@/server/http/platform-api";
import { PLATFORM_ROLE_OPTIONS } from "@/server/runtime/platform-roles";
import type { GymDashboardSnapshot } from "@/server/types";

function fieldClassName() {
  return "brand-input mt-2 h-11 w-full rounded-2xl px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-200";
}

function textareaClassName() {
  return "brand-textarea mt-2 min-h-24 w-full rounded-2xl px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-200";
}

function parseList(input: string) {
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function formatCountLabel(
  count: number,
  singular: string,
  plural: string,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

async function submitJson<TResponse>(
  url: string,
  payload: unknown,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-claimtech-csrf": MUTATION_CSRF_TOKEN,
      "x-idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json()) as {
    ok: boolean;
    data?: TResponse;
    error?: {
      message: string;
    };
  };

  if (!response.ok || !result.ok) {
    throw new Error(result.error?.message ?? "Opslaan is mislukt.");
  }

  return result.data as TResponse;
}

function FormCard({
  visible = true,
  sectionId,
  eyebrow,
  title,
  description,
  countLabel,
  statusLabel,
  statusTone,
  disabled,
  highlighted,
  children,
}: {
  visible?: boolean;
  sectionId?: string;
  eyebrow?: string;
  title: string;
  description: string;
  countLabel: string;
  statusLabel: string;
  statusTone: "complete" | "current" | "upcoming" | "locked";
  disabled?: boolean;
  highlighted?: boolean;
  children: ReactNode;
}) {
  if (!visible) {
    return null;
  }

  return (
    <div
      id={sectionId}
      data-platform-step-key={sectionId?.replace("platform-step-", "")}
      tabIndex={-1}
      className={`editorial-panel relative overflow-hidden transition ${highlighted ? "ring-2 ring-teal-300 ring-offset-2" : ""}`}
    >
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-white/0 via-white/45 to-white/0" />
      <div className="relative space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="eyebrow">{eyebrow ?? "Beheerformulier"}</p>
            <h4 className="text-lg font-semibold text-slate-950">{title}</h4>
            <p className="max-w-xl text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <div className="space-y-2 text-right">
            <span className="status-pill" data-tone={statusTone}>
              {statusLabel}
            </span>
            <p className="text-sm font-medium text-slate-500">{countLabel}</p>
          </div>
        </div>
        <div className="subtle-divider" />
      </div>
      <div className={disabled ? "pointer-events-none mt-4 opacity-60" : "mt-4"}>
        {children}
      </div>
    </div>
  );
}

function preventNativeSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
}

export type PlatformWorkbenchSection =
  | "locations"
  | "contracts"
  | "trainers"
  | "classes"
  | "members"
  | "imports"
  | "staff"
  | "remote-access"
  | "payments"
  | "legal";

const ALL_PLATFORM_WORKBENCH_SECTIONS: ReadonlyArray<PlatformWorkbenchSection> = [
  "locations",
  "contracts",
  "trainers",
  "classes",
  "members",
  "imports",
  "staff",
  "remote-access",
  "payments",
  "legal",
];

export function PlatformWorkbench({
  snapshot,
  highlightStepKey,
  sections = ALL_PLATFORM_WORKBENCH_SECTIONS,
  showLaunchHeader = true,
}: {
  snapshot: GymDashboardSnapshot;
  highlightStepKey?: string | null;
  sections?: ReadonlyArray<PlatformWorkbenchSection>;
  showLaunchHeader?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const visibleSections = new Set<PlatformWorkbenchSection>(sections);

  const [locationName, setLocationName] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationNeighborhood, setLocationNeighborhood] = useState("");
  const [locationCapacity, setLocationCapacity] = useState("120");
  const [locationManagerName, setLocationManagerName] = useState("");
  const [locationAmenities, setLocationAmenities] = useState("");

  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState("99");
  const [planBillingCycle, setPlanBillingCycle] = useState<
    "monthly" | "semiannual" | "annual"
  >(
    "monthly",
  );
  const [planPerks, setPlanPerks] = useState("");
  const [importLocationId, setImportLocationId] = useState(
    snapshot.locations[0]?.id ?? "",
  );
  const [importCsv, setImportCsv] = useState(
    CONTRACT_IMPORT_REQUIRED_CSV_HEADER,
  );

  const [trainerName, setTrainerName] = useState("");
  const [trainerLocationId, setTrainerLocationId] = useState(
    snapshot.locations[0]?.id ?? "",
  );
  const [trainerSpecialties, setTrainerSpecialties] = useState("");
  const [trainerCertifications, setTrainerCertifications] = useState("");

  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberPhoneCountry, setMemberPhoneCountry] = useState("NL");
  const [memberPlanId, setMemberPlanId] = useState(
    snapshot.membershipPlans[0]?.id ?? "",
  );
  const [memberLocationId, setMemberLocationId] = useState(
    snapshot.locations[0]?.id ?? "",
  );
  const [memberStatus, setMemberStatus] = useState<"active" | "trial" | "paused">(
    "active",
  );
  const [memberTags, setMemberTags] = useState("");
  const [memberWaiverStatus, setMemberWaiverStatus] = useState<"complete" | "pending">(
    "pending",
  );

  const [classTitle, setClassTitle] = useState("");
  const [classLocationId, setClassLocationId] = useState(
    snapshot.locations[0]?.id ?? "",
  );
  const [classTrainerId, setClassTrainerId] = useState(
    snapshot.trainers[0]?.id ?? "",
  );
  const [classStartsAt, setClassStartsAt] = useState("");
  const [classDuration, setClassDuration] = useState("60");
  const [classCapacity, setClassCapacity] = useState("12");
  const [classLevel, setClassLevel] = useState<"beginner" | "mixed" | "advanced">(
    "mixed",
  );
  const [classFocus, setClassFocus] = useState("");

  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffRoleKey, setStaffRoleKey] = useState<
    "owner" | "manager" | "trainer" | "frontdesk"
  >("manager");
  const [remoteAccessEnabled, setRemoteAccessEnabled] = useState(
    snapshot.remoteAccess.enabled,
  );
  const [remoteAccessProvider, setRemoteAccessProvider] = useState(
    snapshot.remoteAccess.provider,
  );
  const [remoteAccessBridgeType, setRemoteAccessBridgeType] = useState(
    snapshot.remoteAccess.bridgeType,
  );
  const [remoteAccessLocationId, setRemoteAccessLocationId] = useState(
    snapshot.remoteAccess.locationId ?? "",
  );
  const [remoteAccessDeviceLabel, setRemoteAccessDeviceLabel] = useState(
    snapshot.remoteAccess.deviceLabel,
  );
  const [remoteAccessExternalDeviceId, setRemoteAccessExternalDeviceId] = useState(
    snapshot.remoteAccess.externalDeviceId,
  );
  const [remoteAccessNotes, setRemoteAccessNotes] = useState(
    snapshot.remoteAccess.notes ?? "",
  );
  const [billingEnabled, setBillingEnabled] = useState(snapshot.payments.enabled);
  const [billingProvider, setBillingProvider] = useState(snapshot.payments.provider);
  const [billingProfileLabel, setBillingProfileLabel] = useState(
    snapshot.payments.profileLabel,
  );
  const [billingProfileId, setBillingProfileId] = useState(snapshot.payments.profileId);
  const [billingSettlementLabel, setBillingSettlementLabel] = useState(
    snapshot.payments.settlementLabel,
  );
  const [billingSupportEmail, setBillingSupportEmail] = useState(
    snapshot.payments.supportEmail,
  );
  const [billingPaymentMethods, setBillingPaymentMethods] = useState<
    ReadonlyArray<(typeof snapshot.payments.paymentMethods)[number]>
  >(snapshot.payments.paymentMethods);
  const [billingNotes, setBillingNotes] = useState(snapshot.payments.notes ?? "");
  const [billingPreviewMethod, setBillingPreviewMethod] = useState<
    (typeof snapshot.payments.paymentMethods)[number]
  >(snapshot.payments.paymentMethods[0] ?? "one_time");
  const [billingPreviewAmount, setBillingPreviewAmount] = useState("2495");
  const [billingPreviewDescription, setBillingPreviewDescription] = useState(
    "Intake bundle",
  );
  const [billingPreviewMemberName, setBillingPreviewMemberName] = useState("");
  const [legalTermsUrl, setLegalTermsUrl] = useState(snapshot.legal.termsUrl);
  const [legalPrivacyUrl, setLegalPrivacyUrl] = useState(snapshot.legal.privacyUrl);
  const [legalSepaCreditorId, setLegalSepaCreditorId] = useState(
    snapshot.legal.sepaCreditorId,
  );
  const [legalSepaMandateText, setLegalSepaMandateText] = useState(
    snapshot.legal.sepaMandateText,
  );
  const [legalContractPdfTemplateKey, setLegalContractPdfTemplateKey] = useState(
    snapshot.legal.contractPdfTemplateKey,
  );
  const [legalWaiverStorageKey, setLegalWaiverStorageKey] = useState(
    snapshot.legal.waiverStorageKey,
  );
  const [legalWaiverRetentionMonths, setLegalWaiverRetentionMonths] = useState(
    String(snapshot.legal.waiverRetentionMonths),
  );
  const dashboardExperience = getDashboardExperience({
    locationsCount: snapshot.locations.length,
    membershipPlansCount: snapshot.membershipPlans.length,
    trainersCount: snapshot.trainers.length,
    membersCount: snapshot.members.length,
    classSessionsCount: snapshot.classSessions.length,
    bookingsCount: snapshot.bookings.length,
    healthAttentionCount: snapshot.healthReport.checks.filter(
      (check) => check.status !== "healthy",
    ).length,
  });
  const workbenchExperience = getPlatformWorkbenchExperience({
    locationsCount: snapshot.locations.length,
    membershipPlansCount: snapshot.membershipPlans.length,
    trainersCount: snapshot.trainers.length,
    membersCount: snapshot.members.length,
    classSessionsCount: snapshot.classSessions.length,
    staffCount: snapshot.staff.length,
    canManageStaff: snapshot.uiCapabilities.canManageStaff,
  });
  const stepByKey = new Map(
    workbenchExperience.steps.map((step) => [step.key, step] as const),
  );

  useEffect(() => {
    if (
      snapshot.locations.length > 0 &&
      !snapshot.locations.some((location) => location.id === trainerLocationId)
    ) {
      setTrainerLocationId(snapshot.locations[0]!.id);
    }

    if (
      snapshot.locations.length > 0 &&
      !snapshot.locations.some((location) => location.id === memberLocationId)
    ) {
      setMemberLocationId(snapshot.locations[0]!.id);
    }

    if (
      snapshot.locations.length > 0 &&
      !snapshot.locations.some((location) => location.id === classLocationId)
    ) {
      setClassLocationId(snapshot.locations[0]!.id);
    }

    if (
      snapshot.locations.length > 0 &&
      !snapshot.locations.some((location) => location.id === importLocationId)
    ) {
      setImportLocationId(snapshot.locations[0]!.id);
    }
  }, [
    classLocationId,
    importLocationId,
    memberLocationId,
    snapshot.locations,
    trainerLocationId,
  ]);

  useEffect(() => {
    if (
      snapshot.membershipPlans.length > 0 &&
      !snapshot.membershipPlans.some((plan) => plan.id === memberPlanId)
    ) {
      setMemberPlanId(snapshot.membershipPlans[0]!.id);
    }
  }, [memberPlanId, snapshot.membershipPlans]);

  useEffect(() => {
    if (
      snapshot.trainers.length > 0 &&
      !snapshot.trainers.some((trainer) => trainer.id === classTrainerId)
    ) {
      setClassTrainerId(snapshot.trainers[0]!.id);
    }
  }, [classTrainerId, snapshot.trainers]);

  useEffect(() => {
    setRemoteAccessEnabled(snapshot.remoteAccess.enabled);
    setRemoteAccessProvider(snapshot.remoteAccess.provider);
    setRemoteAccessBridgeType(snapshot.remoteAccess.bridgeType);
    setRemoteAccessLocationId(snapshot.remoteAccess.locationId ?? "");
    setRemoteAccessDeviceLabel(snapshot.remoteAccess.deviceLabel);
    setRemoteAccessExternalDeviceId(snapshot.remoteAccess.externalDeviceId);
    setRemoteAccessNotes(snapshot.remoteAccess.notes ?? "");
  }, [snapshot.remoteAccess]);

  useEffect(() => {
    setBillingEnabled(snapshot.payments.enabled);
    setBillingProvider(snapshot.payments.provider);
    setBillingProfileLabel(snapshot.payments.profileLabel);
    setBillingProfileId(snapshot.payments.profileId);
    setBillingSettlementLabel(snapshot.payments.settlementLabel);
    setBillingSupportEmail(snapshot.payments.supportEmail);
    setBillingPaymentMethods(snapshot.payments.paymentMethods);
    setBillingNotes(snapshot.payments.notes ?? "");
    setBillingPreviewMethod(snapshot.payments.paymentMethods[0] ?? "one_time");
  }, [snapshot.payments]);

  useEffect(() => {
    setLegalTermsUrl(snapshot.legal.termsUrl);
    setLegalPrivacyUrl(snapshot.legal.privacyUrl);
    setLegalSepaCreditorId(snapshot.legal.sepaCreditorId);
    setLegalSepaMandateText(snapshot.legal.sepaMandateText);
    setLegalContractPdfTemplateKey(snapshot.legal.contractPdfTemplateKey);
    setLegalWaiverStorageKey(snapshot.legal.waiverStorageKey);
    setLegalWaiverRetentionMonths(String(snapshot.legal.waiverRetentionMonths));
  }, [snapshot.legal]);

  useEffect(() => {
    if (!highlightStepKey) {
      return;
    }

    const target = document.querySelector<HTMLElement>(
      `[data-platform-step-key="${highlightStepKey}"]`,
    );

    if (!target) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [highlightStepKey]);

  function runAction(action: () => Promise<void>) {
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Opslaan is mislukt.",
        );
      }
    });
  }

  function shouldShowSection(section: PlatformWorkbenchSection) {
    return visibleSections.has(section);
  }

  function formTitle(launchTitle: string, pageTitle: string) {
    return showLaunchHeader ? launchTitle : pageTitle;
  }

  function formEyebrow(step: number) {
    return showLaunchHeader ? `Stap ${step}` : "Beheerformulier";
  }

  function toggleBillingMethod(
    paymentMethod: (typeof snapshot.payments.paymentMethods)[number],
    checked: boolean,
  ) {
    setBillingPaymentMethods((current) => {
      const nextMethods = checked
        ? current.includes(paymentMethod)
          ? current
          : [...current, paymentMethod]
        : current.filter((entry) => entry !== paymentMethod);

      if (!nextMethods.includes(billingPreviewMethod)) {
        setBillingPreviewMethod(nextMethods[0] ?? "one_time");
      }

      return nextMethods;
    });
  }

  const remoteAccessCountLabel = snapshot.remoteAccess.deviceLabel
    ? snapshot.remoteAccess.deviceLabel
    : "Geen slot gekoppeld";
  const remoteAccessStatusTone: "complete" | "current" | "upcoming" | "locked" =
    !snapshot.uiCapabilities.canManageRemoteAccess
      ? "locked"
      : snapshot.remoteAccess.connectionStatus === "configured" &&
          snapshot.remoteAccess.enabled
        ? "complete"
        : snapshot.remoteAccess.connectionStatus === "attention"
          ? "current"
          : "upcoming";
  const paymentsCountLabel =
    snapshot.payments.connectionStatus !== "not_configured" &&
    snapshot.payments.paymentMethods.length > 0
      ? formatCountLabel(
          snapshot.payments.paymentMethods.length,
          "betaalflow klaar",
          "betaalflows klaar",
        )
      : "Nog niet gekoppeld";
  const paymentsStatusTone: "complete" | "current" | "upcoming" | "locked" =
    !snapshot.uiCapabilities.canManagePayments
      ? "locked"
      : snapshot.payments.connectionStatus === "configured" &&
          snapshot.payments.enabled
        ? "complete"
        : snapshot.payments.connectionStatus === "attention"
          ? "current"
          : "upcoming";
  const formGridClassName =
    visibleSections.size === 1 ? "grid gap-4" : "grid gap-4 xl:grid-cols-2";

  if (!snapshot.uiCapabilities.canManagePlatform) {
    return (
      <div className="rounded-[28px] border border-slate-200/80 bg-white/80 p-5 text-sm leading-6 text-slate-600">
        Alleen accounts met beheerrechten kunnen locaties, memberships, teamleden
        en lessen toevoegen.
      </div>
    );
  }

  return (
    <section className="relative space-y-5 overflow-hidden rounded-[32px] border border-slate-200/80 bg-slate-950/[0.03] p-5 md:p-6">
      <div className="pointer-events-none absolute left-[-8rem] top-[-8rem] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(242,140,82,0.2),transparent_68%)] blur-2xl" />
      <div className="pointer-events-none absolute bottom-[-10rem] right-[-8rem] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.16),transparent_68%)] blur-2xl" />

      {showLaunchHeader ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="editorial-panel space-y-4">
              <div className="space-y-2">
                <p className="eyebrow">Inrichten</p>
                <h3 className="text-3xl font-semibold tracking-tight text-slate-950">
                  Bouw je eigen live dataset op
                </h3>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">
                  Deze omgeving start leeg. Voeg eerst je basisgegevens toe, daarna
                  werken boekingen, check-ins en rapportage met je eigen data.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="soft-card">
                  <p className="text-sm font-medium text-slate-500">Vestigingen</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {snapshot.locations.length}
                  </p>
                </div>
                <div className="soft-card">
                  <p className="text-sm font-medium text-slate-500">Memberships</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {snapshot.membershipPlans.length}
                  </p>
                </div>
                <div className="soft-card">
                  <p className="text-sm font-medium text-slate-500">Trainers</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {snapshot.trainers.length}
                  </p>
                </div>
                <div className="soft-card">
                  <p className="text-sm font-medium text-slate-500">Leden</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {snapshot.members.length}
                  </p>
                </div>
                <div className="soft-card">
                  <p className="text-sm font-medium text-slate-500">Lessen</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {snapshot.classSessions.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="command-deck">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
                Launch board
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
                {dashboardExperience.progressValue}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/70">
                {dashboardExperience.progressHelper}
              </p>

              <div className="subtle-divider mt-5 pt-5">
                <p className="text-xs uppercase tracking-[0.18em] text-white/50">
                  Volgende stap
                </p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {dashboardExperience.nextStep.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  {dashboardExperience.nextStep.helper}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {formatCountLabel(snapshot.locations.length, "vestiging", "vestigingen")}
                </Badge>
                <Badge variant="secondary">
                  {formatCountLabel(snapshot.membershipPlans.length, "membership", "memberships")}
                </Badge>
                <Badge variant="secondary">
                  {formatCountLabel(snapshot.trainers.length, "trainer", "trainers")}
                </Badge>
                <Badge variant="secondary">
                  {formatCountLabel(snapshot.members.length, "lid", "leden")}
                </Badge>
                <Badge variant="secondary">
                  {formatCountLabel(snapshot.classSessions.length, "les", "lessen")}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {workbenchExperience.steps.map((step) => (
              <article
                key={step.key}
                className="workbench-step-card"
                data-tone={step.statusTone}
              >
                <div className="relative flex items-start justify-between gap-3">
                  <div className="space-y-3">
                    <p className="eyebrow">Stap {step.order}</p>
                    <div>
                      <p className="text-lg font-semibold text-slate-950">{step.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{step.helper}</p>
                    </div>
                  </div>
                  <span className="status-pill" data-tone={step.statusTone}>
                    {step.statusLabel}
                  </span>
                </div>
                <div className="relative mt-5 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-500">Live status</p>
                  <p className="text-base font-semibold text-slate-950">{step.countLabel}</p>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}

      <div className={formGridClassName}>
        <FormCard
          visible={shouldShowSection("locations")}
          sectionId="platform-step-locations"
          highlighted={highlightStepKey === "locations"}
          eyebrow={formEyebrow(1)}
          title={formTitle("1. Voeg een vestiging toe", "Vestiging toevoegen")}
          description="Maak een echte locatie aan met manager, capaciteit, stad, wijk en faciliteiten. Deze vestiging wordt daarna direct beschikbaar voor trainers, leden en lessen."
          countLabel={stepByKey.get("locations")?.countLabel ?? "0 vestigingen"}
          statusLabel={stepByKey.get("locations")?.statusLabel ?? "Nu"}
          statusTone={stepByKey.get("locations")?.statusTone ?? "current"}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-800">
              Naam
              <input
                className={fieldClassName()}
                value={locationName}
                onChange={(event) => setLocationName(event.target.value)}
                placeholder="Downtown Club"
              />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Manager
              <input
                className={fieldClassName()}
                value={locationManagerName}
                onChange={(event) => setLocationManagerName(event.target.value)}
                placeholder="Naam manager"
              />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Stad
              <input
                className={fieldClassName()}
                value={locationCity}
                onChange={(event) => setLocationCity(event.target.value)}
                placeholder="Amsterdam"
              />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Wijk
              <input
                className={fieldClassName()}
                value={locationNeighborhood}
                onChange={(event) => setLocationNeighborhood(event.target.value)}
                placeholder="Oost"
              />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Capaciteit
              <input
                className={fieldClassName()}
                type="number"
                min={1}
                value={locationCapacity}
                onChange={(event) => setLocationCapacity(event.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Faciliteiten
              <textarea
                className={textareaClassName()}
                value={locationAmenities}
                onChange={(event) => setLocationAmenities(event.target.value)}
                placeholder="Bijvoorbeeld: sauna, open gym, PT studio"
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              disabled={isPending}
              onClick={() =>
                runAction(async () => {
                  await submitJson("/api/platform/locations", {
                    name: locationName,
                    city: locationCity,
                    neighborhood: locationNeighborhood,
                    capacity: Number(locationCapacity),
                    managerName: locationManagerName,
                    amenities: parseList(locationAmenities),
                  });

                  toast.success("Vestiging toegevoegd.");
                  setLocationName("");
                  setLocationCity("");
                  setLocationNeighborhood("");
                  setLocationCapacity("120");
                  setLocationManagerName("");
                  setLocationAmenities("");
                })
              }
            >
              {isPending ? "Opslaan..." : "Vestiging toevoegen"}
            </Button>
          </div>
        </FormCard>

        <FormCard
          visible={shouldShowSection("contracts")}
          sectionId="platform-step-memberships"
          highlighted={highlightStepKey === "memberships"}
          eyebrow={formEyebrow(2)}
          title={formTitle("2. Maak een membership", "Contract toevoegen")}
          description="Leg een verkoopbaar contract vast: maand, 6 maanden of jaar, inclusief prijs en voordelen voor leden."
          countLabel={stepByKey.get("memberships")?.countLabel ?? "0 memberships"}
          statusLabel={stepByKey.get("memberships")?.statusLabel ?? "Daarna"}
          statusTone={stepByKey.get("memberships")?.statusTone ?? "upcoming"}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-800">
              Naam
              <input
                className={fieldClassName()}
                value={planName}
                onChange={(event) => setPlanName(event.target.value)}
                placeholder="Unlimited"
              />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Prijs per maand
              <input
                className={fieldClassName()}
                type="number"
                min={1}
                step="0.01"
                value={planPrice}
                onChange={(event) => setPlanPrice(event.target.value)}
              />
            </label>
                <label className="text-sm font-medium text-slate-800">
                  Contractduur
                  <select
                    className={fieldClassName()}
                    value={planBillingCycle}
                    onChange={(event) =>
                      setPlanBillingCycle(
                        event.target.value as "monthly" | "semiannual" | "annual",
                      )
                    }
                  >
                    {MEMBERSHIP_BILLING_CYCLE_OPTIONS.map((billingCycle) => (
                      <option key={billingCycle.key} value={billingCycle.key}>
                        {billingCycle.label}
                      </option>
                    ))}
                  </select>
                </label>
            <label className="text-sm font-medium text-slate-800">
              Perks
              <textarea
                className={textareaClassName()}
                value={planPerks}
                onChange={(event) => setPlanPerks(event.target.value)}
                placeholder="Bijvoorbeeld: open gym, onbeperkte lessen, priority booking"
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              disabled={isPending}
              onClick={() =>
                runAction(async () => {
                  await submitJson("/api/platform/membership-plans", {
                    name: planName,
                    priceMonthly: Number(planPrice),
                    billingCycle: planBillingCycle,
                    perks: parseList(planPerks),
                  });

                  toast.success("Membership toegevoegd.");
                  setPlanName("");
                  setPlanPrice("99");
                  setPlanBillingCycle("monthly");
                  setPlanPerks("");
                })
              }
            >
              {isPending ? "Opslaan..." : "Membership toevoegen"}
            </Button>
          </div>
        </FormCard>

        <FormCard
          visible={shouldShowSection("trainers")}
          sectionId="platform-step-trainers"
          highlighted={highlightStepKey === "trainers"}
          eyebrow={formEyebrow(3)}
          title={formTitle("3. Voeg een trainer toe", "Trainer toevoegen")}
          description="Voeg een coach toe met thuisvestiging, specialisaties en certificeringen zodat lessen meteen geloofwaardig worden."
          countLabel={stepByKey.get("trainers")?.countLabel ?? "0 trainers"}
          statusLabel={stepByKey.get("trainers")?.statusLabel ?? "Daarna"}
          statusTone={stepByKey.get("trainers")?.statusTone ?? "upcoming"}
          disabled={snapshot.locations.length === 0}
        >
          {snapshot.locations.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Voeg eerst minstens één vestiging toe.
            </p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-800">
                  Naam
                  <input
                    className={fieldClassName()}
                    value={trainerName}
                    onChange={(event) => setTrainerName(event.target.value)}
                    placeholder="Naam trainer"
                  />
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Thuisvestiging
                  <select
                    className={fieldClassName()}
                    value={trainerLocationId}
                    onChange={(event) => setTrainerLocationId(event.target.value)}
                  >
                    {snapshot.locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Specialisaties
                  <textarea
                    className={textareaClassName()}
                    value={trainerSpecialties}
                    onChange={(event) => setTrainerSpecialties(event.target.value)}
                    placeholder="Bijvoorbeeld: Hyrox, yoga, strength"
                  />
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Certificeringen
                  <textarea
                    className={textareaClassName()}
                    value={trainerCertifications}
                    onChange={(event) => setTrainerCertifications(event.target.value)}
                    placeholder="Bijvoorbeeld: NASM-CPT, CF-L2"
                  />
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    runAction(async () => {
                      await submitJson("/api/platform/trainers", {
                        fullName: trainerName,
                        homeLocationId: trainerLocationId,
                        specialties: parseList(trainerSpecialties),
                        certifications: parseList(trainerCertifications),
                      });

                      toast.success("Trainer toegevoegd.");
                      setTrainerName("");
                      setTrainerSpecialties("");
                      setTrainerCertifications("");
                    })
                  }
                >
                  {isPending ? "Opslaan..." : "Trainer toevoegen"}
                </Button>
              </div>
            </>
          )}
        </FormCard>

        <FormCard
          visible={shouldShowSection("classes")}
          sectionId="platform-step-classes"
          highlighted={highlightStepKey === "classes"}
          eyebrow={formEyebrow(4)}
          title={formTitle("4. Plan je eerste les", "Les plannen")}
          description="Plan een les met datum, tijd, trainer, vestiging, niveau, focus en capaciteit. Deze les verschijnt direct in de publieke reserveringsflow."
          countLabel={stepByKey.get("classes")?.countLabel ?? "0 lessen"}
          statusLabel={stepByKey.get("classes")?.statusLabel ?? "Nu"}
          statusTone={stepByKey.get("classes")?.statusTone ?? "upcoming"}
          disabled={snapshot.locations.length === 0 || snapshot.trainers.length === 0}
        >
          {snapshot.locations.length === 0 || snapshot.trainers.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Voeg eerst minstens één vestiging en één trainer toe.
            </p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-800">
                  Titel
                  <input
                    className={fieldClassName()}
                    value={classTitle}
                    onChange={(event) => setClassTitle(event.target.value)}
                    placeholder="Morning Strength"
                  />
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Start
                  <input
                    className={fieldClassName()}
                    type="datetime-local"
                    value={classStartsAt}
                    onChange={(event) => setClassStartsAt(event.target.value)}
                  />
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Vestiging
                  <select
                    className={fieldClassName()}
                    value={classLocationId}
                    onChange={(event) => setClassLocationId(event.target.value)}
                  >
                    {snapshot.locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Trainer
                  <select
                    className={fieldClassName()}
                    value={classTrainerId}
                    onChange={(event) => setClassTrainerId(event.target.value)}
                  >
                    {snapshot.trainers.map((trainer) => (
                      <option key={trainer.id} value={trainer.id}>
                        {trainer.fullName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Duur (minuten)
                  <input
                    className={fieldClassName()}
                    type="number"
                    min={15}
                    value={classDuration}
                    onChange={(event) => setClassDuration(event.target.value)}
                  />
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Capaciteit
                  <input
                    className={fieldClassName()}
                    type="number"
                    min={1}
                    value={classCapacity}
                    onChange={(event) => setClassCapacity(event.target.value)}
                  />
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Niveau
                  <select
                    className={fieldClassName()}
                    value={classLevel}
                    onChange={(event) =>
                      setClassLevel(
                        event.target.value as "beginner" | "mixed" | "advanced",
                      )
                    }
                  >
                    <option value="beginner">Beginner</option>
                    <option value="mixed">Mixed</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Focus
                  <textarea
                    className={textareaClassName()}
                    value={classFocus}
                    onChange={(event) => setClassFocus(event.target.value)}
                    placeholder="Bijvoorbeeld: techniek, engine, mobility"
                  />
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    runAction(async () => {
                      await submitJson("/api/platform/classes", {
                        title: classTitle,
                        locationId: classLocationId,
                        trainerId: classTrainerId,
                        startsAt: new Date(classStartsAt).toISOString(),
                        durationMinutes: Number(classDuration),
                        capacity: Number(classCapacity),
                        level: classLevel,
                        focus: classFocus,
                      });

                      toast.success("Les toegevoegd.");
                      setClassTitle("");
                      setClassStartsAt("");
                      setClassDuration("60");
                      setClassCapacity("12");
                      setClassLevel("mixed");
                      setClassFocus("");
                    })
                  }
                >
                  {isPending ? "Opslaan..." : "Les toevoegen"}
                </Button>
              </div>
            </>
          )}
        </FormCard>

        <FormCard
          visible={shouldShowSection("members")}
          sectionId="platform-step-members"
          highlighted={highlightStepKey === "members"}
          eyebrow={formEyebrow(5)}
          title={formTitle("5. Voeg later je eerste lid toe", "Lid toevoegen")}
          description="Maak een lid aan met contactgegevens, contract, thuisvestiging, status, waiver en tags. Nieuwe publieke reserveringen kunnen ook automatisch trial-leden aanmaken."
          countLabel={stepByKey.get("members")?.countLabel ?? "0 leden"}
          statusLabel={stepByKey.get("members")?.statusLabel ?? "Later"}
          statusTone={stepByKey.get("members")?.statusTone ?? "upcoming"}
          disabled={snapshot.locations.length === 0 || snapshot.membershipPlans.length === 0}
        >
          {snapshot.locations.length === 0 || snapshot.membershipPlans.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Voeg eerst minstens één vestiging en één membership toe.
            </p>
          ) : (
            <>
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm leading-6 text-slate-600">
                Je kunt deze stap ook later doen. Veel gyms zetten eerst hun aanbod
                live en voegen daarna leden handmatig toe of importeren ze vlak voor
                de eerste echte reserveringen.
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-800">
                  Naam
                  <input
                    className={fieldClassName()}
                    value={memberName}
                    onChange={(event) => setMemberName(event.target.value)}
                    placeholder="Naam lid"
                  />
                </label>
                <label className="text-sm font-medium text-slate-800">
                  E-mail
                  <input
                    className={fieldClassName()}
                    type="email"
                    value={memberEmail}
                    onChange={(event) => setMemberEmail(event.target.value)}
                    placeholder="lid@voorbeeld.nl"
                  />
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Membership
                  <select
                    className={fieldClassName()}
                    value={memberPlanId}
                    onChange={(event) => setMemberPlanId(event.target.value)}
                  >
                    {snapshot.membershipPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Vestiging
                  <select
                    className={fieldClassName()}
                    value={memberLocationId}
                    onChange={(event) => setMemberLocationId(event.target.value)}
                  >
                    {snapshot.locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Status
                  <select
                    className={fieldClassName()}
                    value={memberStatus}
                    onChange={(event) =>
                      setMemberStatus(
                        event.target.value as "active" | "trial" | "paused",
                      )
                    }
                  >
                    <option value="active">Actief</option>
                    <option value="trial">Trial</option>
                    <option value="paused">Gepauzeerd</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Waiver
                  <select
                    className={fieldClassName()}
                    value={memberWaiverStatus}
                    onChange={(event) =>
                      setMemberWaiverStatus(
                        event.target.value as "complete" | "pending",
                      )
                    }
                  >
                    <option value="pending">Nog open</option>
                    <option value="complete">Al rond</option>
                  </select>
                </label>
              </div>

              <div className="mt-4">
                <PhoneNumberField
                  country={memberPhoneCountry as never}
                  onCountryChange={(value) => setMemberPhoneCountry(value)}
                  phone={memberPhone}
                  onPhoneChange={setMemberPhone}
                  language="nl"
                  countryLabel="Landcode"
                  phoneLabel="Mobiel nummer"
                />
              </div>

              <label className="mt-4 block text-sm font-medium text-slate-800">
                Tags
                <textarea
                  className={textareaClassName()}
                  value={memberTags}
                  onChange={(event) => setMemberTags(event.target.value)}
                  placeholder="Bijvoorbeeld: morning, hyrox, trial"
                />
              </label>

              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    runAction(async () => {
                      await submitJson("/api/platform/members", {
                        fullName: memberName,
                        email: memberEmail,
                        phone: memberPhone,
                        phoneCountry: memberPhoneCountry,
                        membershipPlanId: memberPlanId,
                        homeLocationId: memberLocationId,
                        status: memberStatus,
                        tags: parseList(memberTags),
                        waiverStatus: memberWaiverStatus,
                      });

                      toast.success("Lid toegevoegd.");
                      setMemberName("");
                      setMemberEmail("");
                      setMemberPhone("");
                      setMemberTags("");
                      setMemberStatus("active");
                      setMemberWaiverStatus("pending");
                    })
                  }
                >
                  {isPending ? "Opslaan..." : "Lid toevoegen"}
                </Button>
              </div>
            </>
          )}
        </FormCard>

        <FormCard
          visible={shouldShowSection("imports")}
          sectionId="platform-step-imports"
          highlighted={highlightStepKey === "imports"}
          eyebrow={formEyebrow(6)}
          title={formTitle("6. Importeer bestaande contracten en klanten", "Contracten en klanten importeren")}
          description="Plak je bestaande klantenlijst of contractexport. Het platform maakt ontbrekende contracttypes en leden automatisch aan."
          countLabel={formatCountLabel(snapshot.members.length, "lid live", "leden live")}
          statusLabel={snapshot.locations.length > 0 ? "Import klaar" : "Eerst vestiging"}
          statusTone={snapshot.locations.length > 0 ? "current" : "locked"}
          disabled={snapshot.locations.length === 0}
        >
          {snapshot.locations.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Voeg eerst minstens één vestiging toe zodat geïmporteerde klanten meteen de juiste thuislocatie krijgen.
            </p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                preventNativeSubmit(event);
                runAction(async () => {
                  const result = await submitJson<{
                    createdMembershipPlans: number;
                    importedMembers: number;
                    skippedMembers: number;
                    skippedEmails: ReadonlyArray<string>;
                  }>("/api/platform/import/contracts", {
                    defaultLocationId: importLocationId,
                    csv: importCsv,
                    phoneCountry: "NL",
                  });

                  toast.success(
                    `${result.importedMembers} klanten geïmporteerd, ${result.createdMembershipPlans} contracten aangemaakt${result.skippedMembers > 0 ? `, ${result.skippedMembers} dubbelen overgeslagen` : ""}.`,
                  );
                });
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm leading-6 text-slate-600">
                <p className="max-w-2xl">
                  Gebruik een CSV met header. Verplicht: naam, email, telefoon,
                  contract, contractduur en prijs. Optioneel: vestiging, status,
                  waiver en tags.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setImportCsv(CONTRACT_IMPORT_REQUIRED_CSV_HEADER)}
                >
                  Genereer CSV-template
                </Button>
              </div>

              <label className="text-sm font-medium text-slate-800">
                Standaard vestiging
                <select
                  className={fieldClassName()}
                  value={importLocationId}
                  onChange={(event) => setImportLocationId(event.target.value)}
                >
                  {snapshot.locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-800">
                Contracten en klantenlijst
                <textarea
                  className={textareaClassName()}
                  value={importCsv}
                  onChange={(event) => setImportCsv(event.target.value)}
                  placeholder={CONTRACT_IMPORT_REQUIRED_CSV_HEADER}
                />
              </label>

              <div className="flex justify-end">
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Importeren..." : "Contracten en klanten importeren"}
                </Button>
              </div>
            </form>
          )}
        </FormCard>

        <FormCard
          visible={shouldShowSection("staff")}
          sectionId="platform-step-staff"
          highlighted={highlightStepKey === "staff"}
          eyebrow={formEyebrow(7)}
          title={formTitle("7. Nodig een teamlid uit", "Teamlid uitnodigen")}
          description="Maak een echt account aan voor owner, manager, trainer of frontdesk met tijdelijk wachtwoord en juiste rol."
          countLabel={stepByKey.get("staff")?.countLabel ?? "0 accounts live"}
          statusLabel={stepByKey.get("staff")?.statusLabel ?? "Owner-only"}
          statusTone={stepByKey.get("staff")?.statusTone ?? "locked"}
          disabled={!snapshot.uiCapabilities.canManageStaff}
        >
          {!snapshot.uiCapabilities.canManageStaff ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Alleen de eigenaar kan teamaccounts aanmaken of rechten aanpassen.
            </p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                preventNativeSubmit(event);
                runAction(async () => {
                  await submitJson("/api/platform/staff", {
                    displayName: staffName,
                    email: staffEmail,
                    password: staffPassword,
                    roleKey: staffRoleKey,
                  });

                  toast.success("Teamaccount toegevoegd.");
                  setStaffName("");
                  setStaffEmail("");
                  setStaffPassword("");
                  setStaffRoleKey("manager");
                });
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-800">
                  Naam
                  <input
                    className={fieldClassName()}
                    value={staffName}
                    autoComplete="name"
                    onChange={(event) => setStaffName(event.target.value)}
                    placeholder="Naam teamlid"
                  />
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Rol
                  <select
                    className={fieldClassName()}
                    value={staffRoleKey}
                    onChange={(event) =>
                      setStaffRoleKey(
                        event.target.value as
                          | "owner"
                          | "manager"
                          | "trainer"
                          | "frontdesk",
                      )
                    }
                  >
                    {PLATFORM_ROLE_OPTIONS.map((role) => (
                      <option key={role.key} value={role.key}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-800">
                  E-mail
                  <input
                    className={fieldClassName()}
                    type="email"
                    autoComplete="username"
                    value={staffEmail}
                    onChange={(event) => setStaffEmail(event.target.value)}
                    placeholder="teamlid@jouwgym.nl"
                  />
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Tijdelijk wachtwoord
                  <input
                    className={fieldClassName()}
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    value={staffPassword}
                    onChange={(event) => setStaffPassword(event.target.value)}
                    placeholder="Minimaal 8 tekens"
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Opslaan..." : "Teamaccount toevoegen"}
                </Button>
              </div>
            </form>
          )}
        </FormCard>

        <FormCard
          visible={shouldShowSection("remote-access")}
          sectionId="platform-step-remote-access"
          eyebrow={formEyebrow(8)}
          title={formTitle("8. Beheer remote toegang", "Smartdeur koppelen")}
          description="Koppel een slim slot zoals Nuki, wijs het aan een vestiging toe en beheer owner-only remote openen."
          countLabel={remoteAccessCountLabel}
          statusLabel={snapshot.remoteAccess.statusLabel}
          statusTone={remoteAccessStatusTone}
          disabled={!snapshot.uiCapabilities.canManageRemoteAccess}
          highlighted={highlightStepKey === "remote-access"}
        >
          {!snapshot.uiCapabilities.canManageRemoteAccess ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Alleen de eigenaar kan slimme sloten koppelen of de deur op afstand openen.
            </p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                preventNativeSubmit(event);
                runAction(async () => {
                  const remoteAccess = await submitJson<
                    GymDashboardSnapshot["remoteAccess"]
                  >("/api/platform/remote-access", {
                    enabled: remoteAccessEnabled,
                    provider: remoteAccessProvider,
                    bridgeType: remoteAccessBridgeType,
                    locationId: remoteAccessLocationId || null,
                    deviceLabel: remoteAccessDeviceLabel,
                    externalDeviceId: remoteAccessExternalDeviceId,
                    notes: remoteAccessNotes || undefined,
                  });

                  toast.success(
                    `${remoteAccess.providerLabel} opgeslagen voor ${remoteAccess.deviceLabel}.`,
                  );
                });
              }}
            >
              <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-sm leading-6 text-slate-600">
                <p className="font-medium text-slate-900">Remote access status</p>
                <p className="mt-2">{snapshot.remoteAccess.helpText}</p>
                {snapshot.remoteAccess.lastRemoteActionAt ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Laatste remote actie: {snapshot.remoteAccess.lastRemoteActionAt}
                    {snapshot.remoteAccess.lastRemoteActionBy
                      ? ` door ${snapshot.remoteAccess.lastRemoteActionBy}`
                      : ""}
                  </p>
                ) : null}
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm font-medium text-slate-900">
                <input
                  type="checkbox"
                  checked={remoteAccessEnabled}
                  onChange={(event) => setRemoteAccessEnabled(event.target.checked)}
                />
                Remote toegang actief voor deze gym
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-800">
                  Provider
                  <select
                    className={fieldClassName()}
                    value={remoteAccessProvider}
                    onChange={(event) =>
                      setRemoteAccessProvider(
                        event.target.value as typeof remoteAccessProvider,
                      )
                    }
                  >
                    {REMOTE_ACCESS_PROVIDER_OPTIONS.map((provider) => (
                      <option key={provider.key} value={provider.key}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Koppelmodus
                  <select
                    className={fieldClassName()}
                    value={remoteAccessBridgeType}
                    onChange={(event) =>
                      setRemoteAccessBridgeType(
                        event.target.value as typeof remoteAccessBridgeType,
                      )
                    }
                  >
                    {REMOTE_ACCESS_BRIDGE_OPTIONS.map((bridgeOption) => (
                      <option key={bridgeOption.key} value={bridgeOption.key}>
                        {bridgeOption.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Vestiging
                  <select
                    className={fieldClassName()}
                    value={remoteAccessLocationId}
                    onChange={(event) => setRemoteAccessLocationId(event.target.value)}
                  >
                    <option value="">Kies later een deur</option>
                    {snapshot.locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Slot- of deuurnaam
                  <input
                    className={fieldClassName()}
                    value={remoteAccessDeviceLabel}
                    onChange={(event) => setRemoteAccessDeviceLabel(event.target.value)}
                    placeholder="Bijvoorbeeld: Hoofdingang"
                  />
                </label>
                <label className="text-sm font-medium text-slate-800 md:col-span-2">
                  Device ID / extern slot-ID
                  <input
                    className={fieldClassName()}
                    value={remoteAccessExternalDeviceId}
                    onChange={(event) =>
                      setRemoteAccessExternalDeviceId(event.target.value)
                    }
                    placeholder="Bijvoorbeeld: nuki-lock-01"
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-800">
                Notities
                <textarea
                  className={textareaClassName()}
                  value={remoteAccessNotes}
                  onChange={(event) => setRemoteAccessNotes(event.target.value)}
                  placeholder="Bijvoorbeeld: alleen gebruiken voor owner remote open buiten openingstijd."
                />
              </label>

              <div className="flex flex-wrap justify-end gap-3">
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Opslaan..." : "Remote toegang opslaan"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    isPending ||
                    !snapshot.remoteAccess.enabled ||
                    snapshot.remoteAccess.connectionStatus !== "configured"
                  }
                  onClick={() =>
                    runAction(async () => {
                      const receipt = await submitJson("/api/platform/remote-access/open", {});
                      const actionReceipt = receipt as {
                        summary: string;
                      };

                      toast.success(actionReceipt.summary);
                    })
                  }
                >
                  Open deur op afstand
                </Button>
              </div>
            </form>
          )}
        </FormCard>

        <FormCard
          visible={shouldShowSection("payments")}
          sectionId="platform-step-payments"
          eyebrow={formEyebrow(9)}
          title={formTitle("9. Koppel betalingen", "Mollie betalingen koppelen")}
          description="Configureer Mollie voor automatische incasso, eenmalige betalingen en deelbare betaalverzoeken per gym."
          countLabel={paymentsCountLabel}
          statusLabel={snapshot.payments.statusLabel}
          statusTone={paymentsStatusTone}
          disabled={!snapshot.uiCapabilities.canManagePayments}
          highlighted={highlightStepKey === "payments"}
        >
          {!snapshot.uiCapabilities.canManagePayments ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Alleen de eigenaar kan betaalproviders koppelen of betaalflows previewen.
            </p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                preventNativeSubmit(event);
                runAction(async () => {
                  const payments = await submitJson<
                    GymDashboardSnapshot["payments"]
                  >("/api/platform/billing", {
                    enabled: billingEnabled,
                    provider: billingProvider,
                    profileLabel: billingProfileLabel,
                    profileId: billingProfileId,
                    settlementLabel: billingSettlementLabel,
                    supportEmail: billingSupportEmail,
                    paymentMethods: billingPaymentMethods,
                    notes: billingNotes || undefined,
                  });

                  toast.success(`${payments.providerLabel} opgeslagen voor ${payments.profileLabel}.`);
                });
              }}
            >
              <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-sm leading-6 text-slate-600">
                <p className="font-medium text-slate-900">Betaalstatus</p>
                <p className="mt-2">{snapshot.payments.helpText}</p>
                {snapshot.payments.lastPaymentActionAt ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Laatste preview: {snapshot.payments.lastPaymentActionAt}
                    {snapshot.payments.lastPaymentActionBy
                      ? ` door ${snapshot.payments.lastPaymentActionBy}`
                      : ""}
                  </p>
                ) : null}
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm font-medium text-slate-900">
                <input
                  type="checkbox"
                  checked={billingEnabled}
                  onChange={(event) => setBillingEnabled(event.target.checked)}
                />
                Betalingen actief voor deze gym
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-800">
                  Provider
                  <select
                    className={fieldClassName()}
                    value={billingProvider}
                    onChange={(event) =>
                      setBillingProvider(event.target.value as typeof billingProvider)
                    }
                  >
                    {BILLING_PROVIDER_OPTIONS.map((provider) => (
                      <option key={provider.key} value={provider.key}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Profielnaam
                  <input
                    className={fieldClassName()}
                    value={billingProfileLabel}
                    onChange={(event) => setBillingProfileLabel(event.target.value)}
                    placeholder="Atlas Forge Payments"
                  />
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Mollie profiel-ID
                  <input
                    className={fieldClassName()}
                    value={billingProfileId}
                    onChange={(event) => setBillingProfileId(event.target.value)}
                    placeholder="pfl_live_..."
                  />
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Uitbetalingslabel
                  <input
                    className={fieldClassName()}
                    value={billingSettlementLabel}
                    onChange={(event) => setBillingSettlementLabel(event.target.value)}
                    placeholder="Atlas Forge Club"
                  />
                </label>
                <label className="text-sm font-medium text-slate-800 md:col-span-2">
                  Support e-mail
                  <input
                    className={fieldClassName()}
                    type="email"
                    value={billingSupportEmail}
                    onChange={(event) => setBillingSupportEmail(event.target.value)}
                    placeholder="billing@jouwgym.nl"
                  />
                </label>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4">
                <p className="text-sm font-medium text-slate-900">Betaalflows</p>
                <div className="grid gap-3 md:grid-cols-3">
                  {BILLING_PAYMENT_METHOD_OPTIONS.map((paymentMethod) => (
                    <label
                      key={paymentMethod.key}
                      className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-700"
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={billingPaymentMethods.includes(paymentMethod.key)}
                          onChange={(event) =>
                            toggleBillingMethod(paymentMethod.key, event.target.checked)
                          }
                        />
                        <div>
                          <p className="font-medium text-slate-900">{paymentMethod.label}</p>
                          <p className="mt-2 leading-6 text-slate-600">{paymentMethod.helper}</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <label className="block text-sm font-medium text-slate-800">
                Notities
                <textarea
                  className={textareaClassName()}
                  value={billingNotes}
                  onChange={(event) => setBillingNotes(event.target.value)}
                  placeholder="Bijvoorbeeld: eerst memberships via incasso, losse intro via betaalverzoek."
                />
              </label>

              <div className="space-y-4 rounded-2xl border border-dashed border-teal-200 bg-teal-50/80 p-4">
                <div>
                  <p className="text-sm font-medium text-teal-950">Preview betaalflow</p>
                  <p className="mt-1 text-sm leading-6 text-teal-900/80">
                    Gebruik dit om te testen hoe een incasso, eenmalige betaling of
                    betaalverzoek straks per gym wordt aangestuurd.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium text-slate-800">
                    Flow
                    <select
                      className={fieldClassName()}
                      value={billingPreviewMethod}
                      onChange={(event) =>
                        setBillingPreviewMethod(
                          event.target.value as typeof billingPreviewMethod,
                        )
                      }
                    >
                      {billingPaymentMethods.map((paymentMethod) => (
                        <option key={paymentMethod} value={paymentMethod}>
                          {BILLING_PAYMENT_METHOD_OPTIONS.find(
                            (option) => option.key === paymentMethod,
                          )?.label ?? paymentMethod}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-800">
                    Bedrag in centen
                    <input
                      className={fieldClassName()}
                      type="number"
                      min={100}
                      step={5}
                      value={billingPreviewAmount}
                      onChange={(event) => setBillingPreviewAmount(event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-800">
                    Omschrijving
                    <input
                      className={fieldClassName()}
                      value={billingPreviewDescription}
                      onChange={(event) => setBillingPreviewDescription(event.target.value)}
                      placeholder="Intake bundle"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-800">
                    Lidnaam
                    <input
                      className={fieldClassName()}
                      value={billingPreviewMemberName}
                      onChange={(event) => setBillingPreviewMemberName(event.target.value)}
                      placeholder="Optioneel"
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <Button type="submit" disabled={isPending || billingPaymentMethods.length === 0}>
                  {isPending ? "Opslaan..." : "Betalingen opslaan"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    isPending ||
                    !snapshot.payments.enabled ||
                    snapshot.payments.connectionStatus !== "configured" ||
                    billingPaymentMethods.length === 0
                  }
                  onClick={() =>
                    runAction(async () => {
                      const receipt = await submitJson("/api/platform/billing/preview", {
                        paymentMethod: billingPreviewMethod,
                        amountCents: Number(billingPreviewAmount),
                        currency: "EUR",
                        description: billingPreviewDescription,
                        memberName: billingPreviewMemberName || undefined,
                      });
                      const previewReceipt = receipt as {
                        summary: string;
                      };

                      toast.success(previewReceipt.summary);
                    })
                  }
                >
                  Preview betaalflow
                </Button>
              </div>
            </form>
          )}
        </FormCard>

        <FormCard
          visible={shouldShowSection("legal")}
          sectionId="platform-step-legal"
          eyebrow="Live readiness"
          title="Juridische flows afronden"
          description="Leg voorwaarden, privacy, SEPA-toestemming, contract-PDF template en waiver-opslag vast voordat leden echt gaan betalen of tekenen."
          countLabel={snapshot.legal.statusLabel}
          statusLabel={snapshot.legal.statusLabel}
          statusTone={snapshot.legal.statusLabel === "Juridisch klaar" ? "complete" : "current"}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              preventNativeSubmit(event);
              runAction(async () => {
                const legal = await submitJson<GymDashboardSnapshot["legal"]>(
                  "/api/platform/legal",
                  {
                    termsUrl: legalTermsUrl,
                    privacyUrl: legalPrivacyUrl,
                    sepaCreditorId: legalSepaCreditorId,
                    sepaMandateText: legalSepaMandateText,
                    contractPdfTemplateKey: legalContractPdfTemplateKey,
                    waiverStorageKey: legalWaiverStorageKey,
                    waiverRetentionMonths: Number(legalWaiverRetentionMonths),
                  },
                );

                toast.success(`${legal.statusLabel}: juridische instellingen opgeslagen.`);
              });
            }}
          >
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-sm leading-6 text-slate-600">
              <p className="font-medium text-slate-900">Juridische status</p>
              <p className="mt-2">{snapshot.legal.helpText}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-800">
                Algemene voorwaarden URL
                <input
                  className={fieldClassName()}
                  value={legalTermsUrl}
                  onChange={(event) => setLegalTermsUrl(event.target.value)}
                  placeholder="https://jouwgym.nl/voorwaarden"
                />
              </label>
              <label className="text-sm font-medium text-slate-800">
                Privacyverklaring URL
                <input
                  className={fieldClassName()}
                  value={legalPrivacyUrl}
                  onChange={(event) => setLegalPrivacyUrl(event.target.value)}
                  placeholder="https://jouwgym.nl/privacy"
                />
              </label>
              <label className="text-sm font-medium text-slate-800">
                SEPA creditor ID
                <input
                  className={fieldClassName()}
                  value={legalSepaCreditorId}
                  onChange={(event) => setLegalSepaCreditorId(event.target.value)}
                  placeholder="NL00ZZZ..."
                />
              </label>
              <label className="text-sm font-medium text-slate-800">
                Contract-PDF template key
                <input
                  className={fieldClassName()}
                  value={legalContractPdfTemplateKey}
                  onChange={(event) => setLegalContractPdfTemplateKey(event.target.value)}
                  placeholder="contracts/templates/membership-v1.pdf"
                />
              </label>
              <label className="text-sm font-medium text-slate-800">
                Waiver opslagpad
                <input
                  className={fieldClassName()}
                  value={legalWaiverStorageKey}
                  onChange={(event) => setLegalWaiverStorageKey(event.target.value)}
                  placeholder="waivers/signed/"
                />
              </label>
              <label className="text-sm font-medium text-slate-800">
                Waiver bewaartermijn maanden
                <input
                  className={fieldClassName()}
                  type="number"
                  min={1}
                  value={legalWaiverRetentionMonths}
                  onChange={(event) => setLegalWaiverRetentionMonths(event.target.value)}
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-slate-800">
              SEPA machtigingstekst
              <textarea
                className={textareaClassName()}
                value={legalSepaMandateText}
                onChange={(event) => setLegalSepaMandateText(event.target.value)}
              />
            </label>

            <div className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Opslaan..." : "Juridische instellingen opslaan"}
              </Button>
            </div>
          </form>
        </FormCard>
      </div>
    </section>
  );
}
