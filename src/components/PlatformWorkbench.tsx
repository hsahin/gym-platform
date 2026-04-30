"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Chip,
  Input,
  Label,
  Switch,
  TextArea,
} from "@heroui/react";
import { CheckboxButtonGroup } from "@heroui-pro/react/checkbox-button-group";
import { Kanban } from "@heroui-pro/react/kanban";
import { NativeSelect } from "@heroui-pro/react/native-select";
import { Segment } from "@heroui-pro/react/segment";
import { toast } from "sonner";
import { HeroPhoneNumberField } from "@/components/HeroPhoneNumberField";
import { submitDashboardMutation } from "@/components/dashboard/dashboard-client-helpers";
import {
  buildWeeklyRecurringLocalStarts,
  CLASS_WEEKDAY_OPTIONS,
  getWeekdayKeyForLocalDateTime,
  type ClassWeekdayKey,
} from "@/lib/class-recurrence";
import {
  BILLING_PAYMENT_METHOD_OPTIONS,
  BILLING_PROVIDER_OPTIONS,
} from "@/lib/billing";
import {
  CONTRACT_IMPORT_REQUIRED_CSV_HEADER,
  MEMBERSHIP_BILLING_CYCLE_OPTIONS,
} from "@/lib/memberships";
import {
  getPlatformWorkbenchExperience,
  type PlatformWorkbenchStep,
} from "@/lib/platform-workbench-experience";
import {
  REMOTE_ACCESS_BRIDGE_OPTIONS,
  REMOTE_ACCESS_PROVIDER_OPTIONS,
} from "@/lib/remote-access";
import { PLATFORM_ROLE_OPTIONS } from "@/server/runtime/platform-roles";
import type { GymDashboardSnapshot } from "@/server/types";

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
  return submitDashboardMutation<TResponse>(url, payload);
}

function statusToneToChip(tone: "complete" | "current" | "upcoming" | "locked") {
  switch (tone) {
    case "complete":
      return { color: "success" as const, variant: "soft" as const };
    case "current":
      return { color: "accent" as const, variant: "soft" as const };
    case "locked":
      return { color: "default" as const, variant: "tertiary" as const };
    default:
      return { color: "warning" as const, variant: "tertiary" as const };
  }
}

const launchKanbanColumns = [
  {
    key: "current",
    title: "Nu doen",
    indicatorClassName: "bg-accent",
    emptyState: "Geen directe setupactie.",
  },
  {
    key: "upcoming",
    title: "Daarna",
    indicatorClassName: "bg-warning",
    emptyState: "Geen vervolgstappen.",
  },
  {
    key: "complete",
    title: "Klaar",
    indicatorClassName: "bg-success",
    emptyState: "Nog niets afgerond.",
  },
  {
    key: "locked",
    title: "Geblokkeerd",
    indicatorClassName: "bg-default",
    emptyState: "Geen geblokkeerde stappen.",
  },
] satisfies ReadonlyArray<{
  key: PlatformWorkbenchStep["statusTone"];
  title: string;
  indicatorClassName: string;
  emptyState: string;
}>;

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="field-stack">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  disabled,
}: {
  readonly label: string;
  readonly name?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: ReadonlyArray<{ value: string; label: string }>;
  readonly disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <NativeSelect fullWidth>
        <NativeSelect.Trigger
          disabled={disabled}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <NativeSelect.Option key={option.value} value={option.value}>
              {option.label}
            </NativeSelect.Option>
          ))}
          <NativeSelect.Indicator />
        </NativeSelect.Trigger>
      </NativeSelect>
    </Field>
  );
}

function SectionCard({
  title,
  description,
  countLabel,
  statusLabel,
  statusTone,
  highlighted,
  disabled,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly countLabel: string;
  readonly statusLabel: string;
  readonly statusTone: "complete" | "current" | "upcoming" | "locked";
  readonly highlighted?: boolean;
  readonly disabled?: boolean;
  readonly children: ReactNode;
}) {
  const chip = statusToneToChip(statusTone);

  return (
    <Card
      className={`rounded-[28px] border-border/80 ${
        highlighted ? "ring-2 ring-accent/20" : ""
      } ${disabled ? "opacity-70" : ""}`}
    >
      <Card.Header className="items-start justify-between gap-4">
        <div className="space-y-2">
          <Card.Title>{title}</Card.Title>
          <Card.Description>{description}</Card.Description>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Chip color={chip.color} size="sm" variant={chip.variant}>
            {statusLabel}
          </Chip>
          <span className="text-muted text-sm">{countLabel}</span>
        </div>
      </Card.Header>
      <Card.Content className="section-stack">{children}</Card.Content>
    </Card>
  );
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

const platformWorkbenchSectionLabels: Record<PlatformWorkbenchSection, string> = {
  locations: "Vestiging",
  contracts: "Lidmaatschap",
  trainers: "Trainer",
  classes: "Les",
  members: "Lid",
  imports: "Import",
  staff: "Team",
  "remote-access": "Smartdeur",
  payments: "Betalingen",
  legal: "Juridisch",
};

export function PlatformWorkbench({
  snapshot,
  highlightStepKey,
  sections = ALL_PLATFORM_WORKBENCH_SECTIONS,
  showLaunchHeader = true,
  stackSections = false,
}: {
  snapshot: GymDashboardSnapshot;
  highlightStepKey?: string | null;
  sections?: ReadonlyArray<PlatformWorkbenchSection>;
  showLaunchHeader?: boolean;
  stackSections?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const visibleSectionTabs = useMemo(
    () => {
      const seenSections = new Set<PlatformWorkbenchSection>();

      return sections
        .filter((section) => {
          if (seenSections.has(section)) {
            return false;
          }

          seenSections.add(section);
          return true;
        })
        .map((section) => ({
          key: section,
          label: platformWorkbenchSectionLabels[section],
        }));
    },
    [sections],
  );
  const visibleSections = useMemo(
    () => new Set(visibleSectionTabs.map((section) => section.key)),
    [visibleSectionTabs],
  );
  const shouldUseSectionTabs = visibleSectionTabs.length > 2;
  const [activeSection, setActiveSection] = useState<PlatformWorkbenchSection>(
    visibleSectionTabs[0]?.key ?? "locations",
  );

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
  >("monthly");
  const [planPerks, setPlanPerks] = useState("");
  const [importLocationId, setImportLocationId] = useState(
    snapshot.locations[0]?.id ?? "",
  );
  const [importCsv, setImportCsv] = useState(CONTRACT_IMPORT_REQUIRED_CSV_HEADER);

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
  const [memberWaiverStatus, setMemberWaiverStatus] = useState<
    "complete" | "pending"
  >("pending");
  const [memberPortalPassword, setMemberPortalPassword] = useState("");
  const [existingMemberPortalMemberId, setExistingMemberPortalMemberId] = useState(
    snapshot.members[0]?.id ?? "",
  );
  const [existingMemberPortalPassword, setExistingMemberPortalPassword] = useState("");

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
  const [classRepeatsWeekly, setClassRepeatsWeekly] = useState(false);
  const [classRecurringWeekdays, setClassRecurringWeekdays] = useState<
    ReadonlyArray<ClassWeekdayKey>
  >([]);
  const [classRecurringUntil, setClassRecurringUntil] = useState("");

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
    "Intakepakket",
  );
  const [billingPreviewMemberName, setBillingPreviewMemberName] = useState("");
  const [mollieClientName, setMollieClientName] = useState(snapshot.tenantName);
  const [mollieClientEmail, setMollieClientEmail] = useState(
    snapshot.payments.supportEmail || snapshot.actorEmail || "",
  );
  const [mollieClientStreet, setMollieClientStreet] = useState("");
  const [mollieClientPostalCode, setMollieClientPostalCode] = useState("");
  const [mollieClientCity, setMollieClientCity] = useState(
    snapshot.locations[0]?.city ?? "",
  );
  const [mollieClientCountry, setMollieClientCountry] = useState("NL");
  const [mollieClientRegistrationNumber, setMollieClientRegistrationNumber] = useState("");
  const [mollieClientVatNumber, setMollieClientVatNumber] = useState("");
  const [mollieClientLegalEntity, setMollieClientLegalEntity] = useState(
    "limited-liability-company",
  );
  const [mollieClientRegistrationOffice, setMollieClientRegistrationOffice] =
    useState("NL");
  const [mollieClientIncorporationDate, setMollieClientIncorporationDate] =
    useState("");

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

  const workbenchExperience = getPlatformWorkbenchExperience({
    locationsCount: snapshot.locations.length,
    membershipPlansCount: snapshot.membershipPlans.length,
    trainersCount: snapshot.trainers.length,
    membersCount: snapshot.members.length,
    classSessionsCount: snapshot.classSessions.length,
    staffCount: snapshot.staff.length,
    canManageStaff: snapshot.uiCapabilities.canManageStaff,
  });

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
    const eligibleMembers = snapshot.members.filter(
      (member) => member.status === "active" || member.status === "trial",
    );

    if (
      eligibleMembers.length > 0 &&
      !eligibleMembers.some((member) => member.id === existingMemberPortalMemberId)
    ) {
      setExistingMemberPortalMemberId(eligibleMembers[0]!.id);
    }
  }, [existingMemberPortalMemberId, snapshot.members]);

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
    if (!classRepeatsWeekly || !classStartsAt) {
      return;
    }

    const anchorWeekday = getWeekdayKeyForLocalDateTime(classStartsAt);

    if (anchorWeekday && classRecurringWeekdays.length === 0) {
      setClassRecurringWeekdays([anchorWeekday]);
    }

    if (!classRecurringUntil) {
      setClassRecurringUntil(classStartsAt.slice(0, 10));
    }
  }, [
    classRecurringUntil,
    classRecurringWeekdays,
    classRepeatsWeekly,
    classStartsAt,
  ]);

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
    setMollieClientName(snapshot.payments.profileLabel || snapshot.tenantName);
    setMollieClientEmail(snapshot.payments.supportEmail || snapshot.actorEmail || "");
    setMollieClientCity(snapshot.locations[0]?.city ?? "");
  }, [snapshot.actorEmail, snapshot.locations, snapshot.payments, snapshot.tenantName]);

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
    if (
      visibleSectionTabs.length > 0 &&
      !visibleSectionTabs.some((section) => section.key === activeSection)
    ) {
      setActiveSection(visibleSectionTabs[0]!.key);
    }
  }, [activeSection, visibleSectionTabs]);

  function runAction(action: () => Promise<void>) {
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Opslaan is mislukt.");
      }
    });
  }

  function shouldShowSection(section: PlatformWorkbenchSection) {
    return visibleSections.has(section) && (!shouldUseSectionTabs || activeSection === section);
  }

  function toggleBillingMethod(
    paymentMethod: (typeof snapshot.payments.paymentMethods)[number],
  ) {
    setBillingPaymentMethods((current) => {
      const exists = current.includes(paymentMethod);
      const nextMethods = exists
        ? current.filter((entry) => entry !== paymentMethod)
        : [...current, paymentMethod];

      if (!nextMethods.includes(billingPreviewMethod)) {
        setBillingPreviewMethod(nextMethods[0] ?? "one_time");
      }

      return nextMethods;
    });
  }

  function isHighlighted(...keys: string[]) {
    return !!highlightStepKey && keys.includes(highlightStepKey);
  }

  const recurringClassStarts = classRepeatsWeekly
    ? buildWeeklyRecurringLocalStarts({
        anchorLocalStart: classStartsAt,
        weekdays: classRecurringWeekdays,
        untilDate: classRecurringUntil,
      })
    : [];
  const classCreateCount = classRepeatsWeekly
    ? recurringClassStarts.length
    : classStartsAt
      ? 1
      : 0;

  const nextStep = workbenchExperience.steps.find(
    (step) => step.statusTone === "current" || step.statusTone === "upcoming",
  );
  const sectionGridClass = stackSections ? "grid content-start gap-4" : "grid gap-4";
  const launchStats = [
    { label: "Vestigingen", value: snapshot.locations.length },
    { label: "Lidmaatschappen", value: snapshot.membershipPlans.length },
    { label: "Trainers", value: snapshot.trainers.length },
    { label: "Leden", value: snapshot.members.length },
    { label: "Lessen", value: snapshot.classSessions.length },
  ];

  if (!snapshot.uiCapabilities.canManagePlatform) {
    return (
      <Card className="rounded-[28px] border-border/80">
        <Card.Content>
          <p className="text-muted text-sm">
            Alleen accounts met beheerrechten kunnen locaties, lidmaatschappen,
            teamleden, betalingen en lessen toevoegen.
          </p>
        </Card.Content>
      </Card>
    );
  }

  return (
    <section className="section-stack">
      {showLaunchHeader ? (
        <>
          <Card className="rounded-[32px] border-border/80">
            <Card.Header className="items-start justify-between gap-4">
              <div className="space-y-3">
                <Chip size="sm" variant="soft">
                  Livegang
                </Chip>
                <Card.Title>Gym opzetten: live dataset eerst op orde.</Card.Title>
                <Card.Description>
                  Vestigingen, lidmaatschappen, trainers, lessen, leden en
                  teamaccounts schrijven direct naar de operationele werkruimte.
                </Card.Description>
              </div>
              {nextStep ? (
                <Button
                  className="shrink-0"
                  variant="outline"
                  onPress={() => router.push(nextStep.href)}
                >
                  {nextStep.ctaLabel}
                </Button>
              ) : null}
            </Card.Header>
            <Card.Content className="section-stack">
              <div className="grid gap-4 md:grid-cols-5">
                {launchStats.map((stat) => (
                  <Card
                    key={stat.label}
                    className="rounded-2xl border-border/70 bg-surface-secondary"
                  >
                    <Card.Content className="metric-stack">
                      <p className="text-muted text-sm">{stat.label}</p>
                      <p className="text-3xl font-semibold tabular-nums">{stat.value}</p>
                    </Card.Content>
                  </Card>
                ))}
              </div>

              {nextStep ? (
                <Card className="rounded-2xl border-border/70 bg-surface-secondary">
                  <Card.Content className="space-y-2">
                    <p className="text-muted text-sm">Volgende focus</p>
                    <p className="text-xl font-semibold">{nextStep.title}</p>
                    <p className="text-muted text-sm leading-6">{nextStep.helper}</p>
                  </Card.Content>
                </Card>
              ) : null}
            </Card.Content>
          </Card>

          <Card className="rounded-[32px] border-border/80">
            <Card.Header className="space-y-3">
              <Chip size="sm" variant="soft">
                Voortgangsbord
              </Chip>
              <Card.Title>Doorloop je gym setup als Kanban.</Card.Title>
              <Card.Description>
                Elke kaart heeft een actieknop naar de juiste dashboardpagina waar je
                die stap direct kunt afronden.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <Kanban
                hideScrollBar
                aria-label="Gym setup voortgang"
                className="items-start overflow-visible"
                size="sm"
              >
                {launchKanbanColumns.map((column) => {
                  const columnSteps = workbenchExperience.steps.filter(
                    (step) => step.statusTone === column.key,
                  );

                  return (
                    <Kanban.Column key={column.key}>
                      <Kanban.ColumnHeader>
                        <Kanban.ColumnIndicator className={column.indicatorClassName} />
                        <Kanban.ColumnTitle>{column.title}</Kanban.ColumnTitle>
                        <Kanban.ColumnCount>{columnSteps.length}</Kanban.ColumnCount>
                      </Kanban.ColumnHeader>
                      <Kanban.ColumnBody className="bg-surface-secondary/80">
                        <Kanban.CardList
                          aria-label={`${column.title} setupstappen`}
                          items={columnSteps}
                          renderEmptyState={() => (
                            <span className="text-muted text-sm">{column.emptyState}</span>
                          )}
                        >
                          {(step) => {
                            const chip = statusToneToChip(step.statusTone);

                            return (
                              <Kanban.Card id={step.key} textValue={step.title}>
                                <div className="space-y-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1">
                                      <p className="text-muted text-xs uppercase tracking-[0.18em]">
                                        Stap {step.order}
                                      </p>
                                      <p className="font-semibold leading-snug">
                                        {step.title}
                                      </p>
                                    </div>
                                    <Chip color={chip.color} size="sm" variant={chip.variant}>
                                      {step.statusLabel}
                                    </Chip>
                                  </div>
                                  <p className="text-muted text-sm leading-6">{step.helper}</p>
                                  <p className="text-sm font-medium">{step.countLabel}</p>
                                  <Button
                                    fullWidth
                                    size="sm"
                                    variant={
                                      step.statusTone === "current" ? "primary" : "outline"
                                    }
                                    onPress={() => router.push(step.href)}
                                  >
                                    {step.ctaLabel}
                                  </Button>
                                </div>
                              </Kanban.Card>
                            );
                          }}
                        </Kanban.CardList>
                      </Kanban.ColumnBody>
                    </Kanban.Column>
                  );
                })}
              </Kanban>
            </Card.Content>
          </Card>
        </>
      ) : null}

      {shouldUseSectionTabs ? (
        <Segment
          aria-label="Formuliersecties"
          className="w-full"
          selectedKey={activeSection}
          size="sm"
          onSelectionChange={(key) => setActiveSection(String(key) as PlatformWorkbenchSection)}
        >
          {visibleSectionTabs.map((section) => (
            <Segment.Item key={section.key} id={section.key}>
              {section.label}
            </Segment.Item>
          ))}
        </Segment>
      ) : null}

      <div className={sectionGridClass}>
        {shouldShowSection("locations") ? (
          <SectionCard
            countLabel={formatCountLabel(snapshot.locations.length, "vestiging", "vestigingen")}
            description="Voeg de vestiging, manager, capaciteit en faciliteiten toe. Daarna kun je trainers, leden en lessen koppelen."
            highlighted={isHighlighted("locations")}
            statusLabel={snapshot.locations.length > 0 ? "Klaar" : "Nu"}
            statusTone={snapshot.locations.length > 0 ? "complete" : "current"}
            title="Vestiging toevoegen"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Naam">
                <Input fullWidth placeholder="Downtown Club" value={locationName} onChange={(event) => setLocationName(event.target.value)} />
              </Field>
              <Field label="Manager">
                <Input fullWidth placeholder="Naam manager" value={locationManagerName} onChange={(event) => setLocationManagerName(event.target.value)} />
              </Field>
              <Field label="Stad">
                <Input fullWidth placeholder="Amsterdam" value={locationCity} onChange={(event) => setLocationCity(event.target.value)} />
              </Field>
              <Field label="Wijk">
                <Input fullWidth placeholder="Oost" value={locationNeighborhood} onChange={(event) => setLocationNeighborhood(event.target.value)} />
              </Field>
              <Field label="Capaciteit">
                <Input fullWidth min={1} type="number" value={locationCapacity} onChange={(event) => setLocationCapacity(event.target.value)} />
              </Field>
              <Field label="Faciliteiten">
                <TextArea fullWidth rows={4} placeholder="sauna, PT studio, open gym" value={locationAmenities} onChange={(event) => setLocationAmenities(event.target.value)} />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button
                isDisabled={isPending}
                onPress={() =>
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
          </SectionCard>
        ) : null}

        {shouldShowSection("contracts") ? (
          <SectionCard
            countLabel={formatCountLabel(snapshot.membershipPlans.length, "lidmaatschap", "lidmaatschappen")}
            description="Leg vast welke lidmaatschappen je verkoopt: contractduur, maandwaarde en belangrijkste voordelen."
            highlighted={isHighlighted("memberships", "contracts")}
            statusLabel={snapshot.membershipPlans.length > 0 ? "Klaar" : "Nu"}
            statusTone={snapshot.membershipPlans.length > 0 ? "complete" : "current"}
            title="Lidmaatschap toevoegen"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Naam">
                <Input fullWidth placeholder="Unlimited" value={planName} onChange={(event) => setPlanName(event.target.value)} />
              </Field>
              <Field label="Prijs per maand">
                <Input fullWidth min={1} step="0.01" type="number" value={planPrice} onChange={(event) => setPlanPrice(event.target.value)} />
              </Field>
              <SelectField
                label="Contractduur"
                options={MEMBERSHIP_BILLING_CYCLE_OPTIONS.map((option) => ({
                  value: option.key,
                  label: option.label,
                }))}
                value={planBillingCycle}
                onChange={(value) => setPlanBillingCycle(value as typeof planBillingCycle)}
              />
              <Field label="Voordelen">
                <TextArea fullWidth rows={4} placeholder="open gym, voorrang bij boeken" value={planPerks} onChange={(event) => setPlanPerks(event.target.value)} />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button
                isDisabled={isPending}
                onPress={() =>
                  runAction(async () => {
                    await submitJson("/api/platform/membership-plans", {
                      name: planName,
                      priceMonthly: Number(planPrice),
                      billingCycle: planBillingCycle,
                      perks: parseList(planPerks),
                    });
                    toast.success("Lidmaatschap toegevoegd.");
                    setPlanName("");
                    setPlanPrice("99");
                    setPlanBillingCycle("monthly");
                    setPlanPerks("");
                  })
                }
              >
                {isPending ? "Opslaan..." : "Lidmaatschap toevoegen"}
              </Button>
            </div>
          </SectionCard>
        ) : null}

        {shouldShowSection("trainers") ? (
          <SectionCard
            countLabel={formatCountLabel(snapshot.trainers.length, "trainer", "trainers")}
            description="Voeg de coaches toe die het rooster dragen, inclusief thuisvestiging en expertise."
            disabled={snapshot.locations.length === 0}
            highlighted={isHighlighted("trainers")}
            statusLabel={snapshot.trainers.length > 0 ? "Klaar" : "Daarna"}
            statusTone={snapshot.trainers.length > 0 ? "complete" : "upcoming"}
            title="Trainer toevoegen"
          >
            {snapshot.locations.length === 0 ? (
              <p className="text-muted text-sm">Voeg eerst minstens één vestiging toe.</p>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Naam">
                    <Input fullWidth placeholder="Naam trainer" value={trainerName} onChange={(event) => setTrainerName(event.target.value)} />
                  </Field>
                  <SelectField
                    label="Thuisvestiging"
                    options={snapshot.locations.map((location) => ({
                      value: location.id,
                      label: location.name,
                    }))}
                    value={trainerLocationId}
                    onChange={setTrainerLocationId}
                  />
                  <Field label="Specialisaties">
                    <TextArea fullWidth rows={4} placeholder="Hyrox, yoga, strength" value={trainerSpecialties} onChange={(event) => setTrainerSpecialties(event.target.value)} />
                  </Field>
                  <Field label="Certificeringen">
                    <TextArea fullWidth rows={4} placeholder="NASM-CPT, CF-L2" value={trainerCertifications} onChange={(event) => setTrainerCertifications(event.target.value)} />
                  </Field>
                </div>
                <div className="flex justify-end">
                  <Button
                    isDisabled={isPending}
                    onPress={() =>
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
          </SectionCard>
        ) : null}

        {shouldShowSection("classes") ? (
          <SectionCard
            countLabel={formatCountLabel(snapshot.classSessions.length, "les", "lessen")}
            description="Plan een losse les of een wekelijkse reeks met trainer, vestiging, niveau en capaciteit."
            disabled={snapshot.locations.length === 0 || snapshot.trainers.length === 0}
            highlighted={isHighlighted("classes")}
            statusLabel={snapshot.classSessions.length > 0 ? "Klaar" : "Nu"}
            statusTone={snapshot.classSessions.length > 0 ? "complete" : "current"}
            title="Les plannen"
          >
            {snapshot.locations.length === 0 || snapshot.trainers.length === 0 ? (
              <p className="text-muted text-sm">
                Voeg eerst minstens één vestiging en één trainer toe.
              </p>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Titel">
                    <Input fullWidth placeholder="Morning Strength" value={classTitle} onChange={(event) => setClassTitle(event.target.value)} />
                  </Field>
                  <Field label="Start">
                    <Input fullWidth type="datetime-local" value={classStartsAt} onChange={(event) => setClassStartsAt(event.target.value)} />
                  </Field>
                  <div className="md:col-span-2">
                    <div className="grid gap-4 rounded-2xl border border-border/70 bg-surface-secondary px-4 py-4">
                      <Switch
                        isSelected={classRepeatsWeekly}
                        onChange={setClassRepeatsWeekly}
                      >
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Content>
                          <Label>Wekelijks herhalen</Label>
                        </Switch.Content>
                      </Switch>

                      {classRepeatsWeekly ? (
                        <div className="grid gap-4">
                          <Field label="Dagen">
                            <CheckboxButtonGroup
                              className="w-full grid-cols-4 gap-2 md:grid-cols-7"
                              layout="grid"
                              value={[...classRecurringWeekdays]}
                              onChange={(value) =>
                                setClassRecurringWeekdays(value as ClassWeekdayKey[])
                              }
                            >
                              {CLASS_WEEKDAY_OPTIONS.map((weekday) => (
                                <CheckboxButtonGroup.Item
                                  key={weekday.key}
                                  value={weekday.key}
                                >
                                  <CheckboxButtonGroup.ItemContent className="items-center justify-center text-center">
                                    <span className="text-sm font-medium">
                                      {weekday.label}
                                    </span>
                                  </CheckboxButtonGroup.ItemContent>
                                </CheckboxButtonGroup.Item>
                              ))}
                            </CheckboxButtonGroup>
                          </Field>

                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                            <Field label="Herhaal t/m">
                              <Input
                                fullWidth
                                type="date"
                                value={classRecurringUntil}
                                onChange={(event) =>
                                  setClassRecurringUntil(event.target.value)
                                }
                              />
                            </Field>
                            {classCreateCount > 0 ? (
                              <Chip size="sm" variant="soft" className="w-fit">
                                {formatCountLabel(classCreateCount, "les", "lessen")}
                              </Chip>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <SelectField
                    label="Vestiging"
                    options={snapshot.locations.map((location) => ({
                      value: location.id,
                      label: location.name,
                    }))}
                    value={classLocationId}
                    onChange={setClassLocationId}
                  />
                  <SelectField
                    label="Trainer"
                    options={snapshot.trainers.map((trainer) => ({
                      value: trainer.id,
                      label: trainer.fullName,
                    }))}
                    value={classTrainerId}
                    onChange={setClassTrainerId}
                  />
                  <Field label="Duur (minuten)">
                    <Input fullWidth min={15} type="number" value={classDuration} onChange={(event) => setClassDuration(event.target.value)} />
                  </Field>
                  <Field label="Capaciteit">
                    <Input fullWidth min={1} type="number" value={classCapacity} onChange={(event) => setClassCapacity(event.target.value)} />
                  </Field>
                  <SelectField
                    label="Niveau"
                    options={[
                      { value: "beginner", label: "Beginner" },
                      { value: "mixed", label: "Gemengd" },
                      { value: "advanced", label: "Gevorderd" },
                    ]}
                    value={classLevel}
                    onChange={(value) => setClassLevel(value as typeof classLevel)}
                  />
                  <Field label="Focus">
                    <TextArea fullWidth rows={4} placeholder="techniek, engine, mobility" value={classFocus} onChange={(event) => setClassFocus(event.target.value)} />
                  </Field>
                </div>
                <div className="flex justify-end">
                  <Button
                    isDisabled={isPending}
                    onPress={() =>
                      runAction(async () => {
                        const startsToCreate = classRepeatsWeekly
                          ? recurringClassStarts
                          : classStartsAt
                            ? [classStartsAt]
                            : [];

                        if (startsToCreate.length === 0) {
                          throw new Error(
                            classRepeatsWeekly
                              ? "Kies minstens één dag en een geldige einddatum voor de herhaling."
                              : "Kies eerst een geldige startdatum en tijd.",
                          );
                        }

                        const seriesId = classRepeatsWeekly
                          ? `series_${crypto.randomUUID()}`
                          : undefined;

                        await submitJson("/api/platform/classes", {
                          classes: startsToCreate.map((localStart) => ({
                            title: classTitle,
                            ...(seriesId ? { seriesId } : {}),
                            locationId: classLocationId,
                            trainerId: classTrainerId,
                            startsAt: new Date(localStart).toISOString(),
                            durationMinutes: Number(classDuration),
                            capacity: Number(classCapacity),
                            level: classLevel,
                            focus: classFocus,
                          })),
                        });

                        toast.success(
                          startsToCreate.length === 1
                            ? "Les toegevoegd."
                            : `${startsToCreate.length} lessen toegevoegd.`,
                        );
                        setClassTitle("");
                        setClassStartsAt("");
                        setClassDuration("60");
                        setClassCapacity("12");
                        setClassLevel("mixed");
                        setClassFocus("");
                        setClassRepeatsWeekly(false);
                        setClassRecurringWeekdays([]);
                        setClassRecurringUntil("");
                      })
                    }
                  >
                    {isPending
                      ? "Opslaan..."
                      : classCreateCount > 1
                        ? "Lessen toevoegen"
                        : "Les toevoegen"}
                  </Button>
                </div>
              </>
            )}
          </SectionCard>
        ) : null}

        {shouldShowSection("members") ? (
          <SectionCard
            countLabel={formatCountLabel(snapshot.members.length, "lid", "leden")}
            description="Voeg leden handmatig toe wanneer nodig, of importeer ze later zodra je aanbod live staat."
            disabled={snapshot.locations.length === 0 || snapshot.membershipPlans.length === 0}
            highlighted={isHighlighted("members")}
            statusLabel={snapshot.members.length > 0 ? "Klaar" : "Later"}
            statusTone={snapshot.members.length > 0 ? "complete" : "upcoming"}
            title="Lid toevoegen"
          >
            {snapshot.locations.length === 0 || snapshot.membershipPlans.length === 0 ? (
              <p className="text-muted text-sm">
                Voeg eerst minstens één vestiging en één membership toe.
              </p>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Naam">
                    <Input fullWidth placeholder="Naam lid" value={memberName} onChange={(event) => setMemberName(event.target.value)} />
                  </Field>
                  <Field label="E-mail">
                    <Input fullWidth placeholder="lid@voorbeeld.nl" type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} />
                  </Field>
                  <SelectField
                    label="Lidmaatschap"
                    options={snapshot.membershipPlans.map((plan) => ({
                      value: plan.id,
                      label: plan.name,
                    }))}
                    value={memberPlanId}
                    onChange={setMemberPlanId}
                  />
                  <SelectField
                    label="Vestiging"
                    options={snapshot.locations.map((location) => ({
                      value: location.id,
                      label: location.name,
                    }))}
                    value={memberLocationId}
                    onChange={setMemberLocationId}
                  />
                  <SelectField
                    label="Status"
                    options={[
                      { value: "active", label: "Actief" },
                      { value: "trial", label: "Trial" },
                      { value: "paused", label: "Gepauzeerd" },
                    ]}
                    value={memberStatus}
                    onChange={(value) => setMemberStatus(value as typeof memberStatus)}
                  />
                  <SelectField
                    label="Waiver"
                    options={[
                      { value: "pending", label: "Nog open" },
                      { value: "complete", label: "Al rond" },
                    ]}
                    value={memberWaiverStatus}
                    onChange={(value) => setMemberWaiverStatus(value as typeof memberWaiverStatus)}
                  />
                </div>

                <HeroPhoneNumberField
                  country={memberPhoneCountry}
                  onCountryChange={setMemberPhoneCountry}
                  phone={memberPhone}
                  onPhoneChange={setMemberPhone}
                />

                <Field label="Tags">
                  <TextArea fullWidth rows={4} placeholder="morning, hyrox, trial" value={memberTags} onChange={(event) => setMemberTags(event.target.value)} />
                </Field>

                <Field label="Portal wachtwoord (optioneel)">
                  <Input
                    fullWidth
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="Minimaal 8 tekens"
                    type="password"
                    value={memberPortalPassword}
                    onChange={(event) => setMemberPortalPassword(event.target.value)}
                  />
                </Field>

                <div className="flex justify-between gap-3">
                  <div className="text-muted text-sm leading-6">
                    Vul een wachtwoord in als dit lid direct moet kunnen inloggen op de
                    reserveringsflow.
                  </div>
                  <Button
                    isDisabled={isPending}
                    onPress={() =>
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
                          portalPassword: memberPortalPassword || undefined,
                        });
                        toast.success("Lid toegevoegd.");
                        setMemberName("");
                        setMemberEmail("");
                        setMemberPhone("");
                        setMemberTags("");
                        setMemberStatus("active");
                        setMemberWaiverStatus("pending");
                        setMemberPortalPassword("");
                      })
                    }
                  >
                    {isPending ? "Opslaan..." : "Lid toevoegen"}
                  </Button>
                </div>

                {snapshot.members.some(
                  (member) => member.status === "active" || member.status === "trial",
                ) ? (
                  <div className="section-stack rounded-2xl border border-border/70 bg-surface-secondary px-4 py-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">Portaltoegang voor bestaand lid</p>
                      <p className="text-muted text-sm">
                        Stel een nieuw wachtwoord in of activeer toegang voor een bestaand lid.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <SelectField
                        label="Lid"
                        options={snapshot.members
                          .filter((member) => member.status === "active" || member.status === "trial")
                          .map((member) => ({
                            value: member.id,
                            label: `${member.fullName}${snapshot.memberPortalAccessMemberIds.includes(member.id) ? " · portal actief" : ""}`,
                          }))}
                        value={existingMemberPortalMemberId}
                        onChange={setExistingMemberPortalMemberId}
                      />
                      <Field label="Nieuw wachtwoord">
                        <Input
                          fullWidth
                          autoComplete="new-password"
                          minLength={8}
                          placeholder="Minimaal 8 tekens"
                          type="password"
                          value={existingMemberPortalPassword}
                          onChange={(event) => setExistingMemberPortalPassword(event.target.value)}
                        />
                      </Field>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        isDisabled={
                          isPending ||
                          !existingMemberPortalMemberId ||
                          existingMemberPortalPassword.trim().length < 8
                        }
                        variant="secondary"
                        onPress={() =>
                          runAction(async () => {
                            await submitJson("/api/platform/member-portal-access", {
                              memberId: existingMemberPortalMemberId,
                              password: existingMemberPortalPassword,
                            });
                            toast.success("Portalwachtwoord opgeslagen.");
                            setExistingMemberPortalPassword("");
                          })
                        }
                      >
                        {isPending ? "Opslaan..." : "Portal toegang opslaan"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </SectionCard>
        ) : null}

        {shouldShowSection("imports") ? (
          <SectionCard
            countLabel={formatCountLabel(snapshot.members.length, "lid live", "leden live")}
            description="Plak bestaande leden- en contractdata. Ontbrekende lidmaatschappen worden automatisch aangemaakt."
            disabled={snapshot.locations.length === 0}
            highlighted={isHighlighted("imports")}
            statusLabel={snapshot.locations.length > 0 ? "Import klaar" : "Eerst vestiging"}
            statusTone={snapshot.locations.length > 0 ? "current" : "locked"}
            title="Contracten en klanten importeren"
          >
            {snapshot.locations.length === 0 ? (
              <p className="text-muted text-sm">
                Voeg eerst minstens één vestiging toe zodat geïmporteerde klanten meteen een thuislocatie krijgen.
              </p>
            ) : (
              <form
                className="section-stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  runAction(async () => {
                    const result = await submitJson<{
                      createdMembershipPlans: number;
                      importedMembers: number;
                      skippedMembers: number;
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
                <div className="flex flex-wrap justify-between gap-3 rounded-2xl border border-border/70 bg-surface-secondary px-4 py-3">
                  <p className="text-muted text-sm">
                    Verplicht: naam, email, telefoon, contract, contractduur en prijs.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onPress={() => setImportCsv(CONTRACT_IMPORT_REQUIRED_CSV_HEADER)}
                  >
                    CSV-template
                  </Button>
                </div>
                <SelectField
                  label="Standaard vestiging"
                  options={snapshot.locations.map((location) => ({
                    value: location.id,
                    label: location.name,
                  }))}
                  value={importLocationId}
                  onChange={setImportLocationId}
                />
                <Field label="Contracten en klantenlijst">
                  <TextArea fullWidth rows={10} placeholder={CONTRACT_IMPORT_REQUIRED_CSV_HEADER} value={importCsv} onChange={(event) => setImportCsv(event.target.value)} />
                </Field>
                <div className="flex justify-end">
                  <Button isDisabled={isPending} type="submit">
                    {isPending ? "Importeren..." : "Import starten"}
                  </Button>
                </div>
              </form>
            )}
          </SectionCard>
        ) : null}

        {shouldShowSection("staff") ? (
          <SectionCard
            countLabel={formatCountLabel(snapshot.staff.length, "account live", "accounts live")}
            description="Nodig owner-, manager-, trainer- of frontdeskaccounts uit met de juiste rol."
            disabled={!snapshot.uiCapabilities.canManageStaff}
            highlighted={isHighlighted("staff")}
            statusLabel={snapshot.uiCapabilities.canManageStaff ? "Owner" : "Alleen owner"}
            statusTone={snapshot.uiCapabilities.canManageStaff ? "current" : "locked"}
            title="Teamlid uitnodigen"
          >
            {!snapshot.uiCapabilities.canManageStaff ? (
              <p className="text-muted text-sm">
                Alleen de eigenaar kan teamaccounts aanmaken of rechten aanpassen.
              </p>
            ) : (
              <form
                className="section-stack"
                onSubmit={(event) => {
                  event.preventDefault();
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
                  <Field label="Naam">
                    <Input fullWidth autoComplete="name" placeholder="Naam teamlid" value={staffName} onChange={(event) => setStaffName(event.target.value)} />
                  </Field>
                  <SelectField
                    label="Rol"
                    options={PLATFORM_ROLE_OPTIONS.map((role) => ({
                      value: role.key,
                      label: role.label,
                    }))}
                    value={staffRoleKey}
                    onChange={(value) => setStaffRoleKey(value as typeof staffRoleKey)}
                  />
                  <Field label="E-mail">
                    <Input fullWidth autoComplete="username" placeholder="teamlid@jouwgym.nl" type="email" value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} />
                  </Field>
                  <Field label="Tijdelijk wachtwoord">
                    <Input fullWidth autoComplete="new-password" minLength={8} placeholder="Minimaal 8 tekens" type="password" value={staffPassword} onChange={(event) => setStaffPassword(event.target.value)} />
                  </Field>
                </div>
                <div className="flex justify-end">
                  <Button isDisabled={isPending} type="submit">
                    {isPending ? "Opslaan..." : "Teamaccount toevoegen"}
                  </Button>
                </div>
              </form>
            )}
          </SectionCard>
        ) : null}

        {shouldShowSection("remote-access") ? (
          <SectionCard
            countLabel={snapshot.remoteAccess.deviceLabel || "Geen slot gekoppeld"}
            description="Koppel het slimme slot, wijs het toe aan een vestiging en houd openen op afstand owner-only."
            disabled={!snapshot.uiCapabilities.canManageRemoteAccess}
            highlighted={isHighlighted("remote-access")}
            statusLabel={snapshot.remoteAccess.statusLabel}
            statusTone={
              !snapshot.uiCapabilities.canManageRemoteAccess
                ? "locked"
                : snapshot.remoteAccess.connectionStatus === "configured" &&
                    snapshot.remoteAccess.enabled
                  ? "complete"
                  : snapshot.remoteAccess.connectionStatus === "attention"
                    ? "current"
                    : "upcoming"
            }
            title="Smartdeur koppelen"
          >
            {!snapshot.uiCapabilities.canManageRemoteAccess ? (
              <p className="text-muted text-sm">
                Alleen de eigenaar kan slimme sloten koppelen of de deur op afstand openen.
              </p>
            ) : (
              <form
                className="section-stack"
                onSubmit={(event) => {
                  event.preventDefault();
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
                <Card className="rounded-2xl border-border/70 bg-surface-secondary">
                  <Card.Content className="space-y-2">
                    <p className="font-medium">Smartdeurstatus</p>
                    <p className="text-muted text-sm leading-6">
                      {snapshot.remoteAccess.helpText}
                    </p>
                  </Card.Content>
                </Card>

                <Switch
                  isSelected={remoteAccessEnabled}
                  onChange={setRemoteAccessEnabled}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Switch.Content>
                    <Label>Remote toegang actief voor deze gym</Label>
                  </Switch.Content>
                </Switch>

                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField
                    label="Provider"
                    options={REMOTE_ACCESS_PROVIDER_OPTIONS.map((provider) => ({
                      value: provider.key,
                      label: provider.label,
                    }))}
                    value={remoteAccessProvider}
                    onChange={(value) => setRemoteAccessProvider(value as typeof remoteAccessProvider)}
                  />
                  <SelectField
                    label="Koppelmodus"
                    options={REMOTE_ACCESS_BRIDGE_OPTIONS.map((option) => ({
                      value: option.key,
                      label: option.label,
                    }))}
                    value={remoteAccessBridgeType}
                    onChange={(value) => setRemoteAccessBridgeType(value as typeof remoteAccessBridgeType)}
                  />
                  <SelectField
                    label="Vestiging"
                    options={[
                      { value: "", label: "Kies later een deur" },
                      ...snapshot.locations.map((location) => ({
                        value: location.id,
                        label: location.name,
                      })),
                    ]}
                    value={remoteAccessLocationId}
                    onChange={setRemoteAccessLocationId}
                  />
                  <Field label="Slot- of deuurnaam">
                    <Input fullWidth placeholder="Hoofdingang" value={remoteAccessDeviceLabel} onChange={(event) => setRemoteAccessDeviceLabel(event.target.value)} />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Device ID / extern slot-ID">
                      <Input fullWidth placeholder="nuki-lock-01" value={remoteAccessExternalDeviceId} onChange={(event) => setRemoteAccessExternalDeviceId(event.target.value)} />
                    </Field>
                  </div>
                </div>

                <Field label="Notities">
                  <TextArea fullWidth rows={4} placeholder="alleen gebruiken buiten openingstijd" value={remoteAccessNotes} onChange={(event) => setRemoteAccessNotes(event.target.value)} />
                </Field>

                <div className="flex flex-wrap justify-end gap-3">
                  <Button isDisabled={isPending} type="submit">
                    {isPending ? "Opslaan..." : "Remote toegang opslaan"}
                  </Button>
                  <Button
                    isDisabled={
                      isPending ||
                      !snapshot.remoteAccess.enabled ||
                      snapshot.remoteAccess.connectionStatus !== "configured"
                    }
                    type="button"
                    variant="outline"
                    onPress={() =>
                      runAction(async () => {
                        const receipt = await submitJson<{ summary: string }>(
                          "/api/platform/remote-access/open",
                          {},
                        );

                        toast.success(receipt.summary);
                      })
                    }
                  >
                    Open deur op afstand
                  </Button>
                </div>
              </form>
            )}
          </SectionCard>
        ) : null}

        {shouldShowSection("payments") ? (
          <SectionCard
            countLabel={
              snapshot.payments.connectionStatus !== "not_configured" &&
              snapshot.payments.paymentMethods.length > 0
                ? formatCountLabel(
                    snapshot.payments.paymentMethods.length,
                    "betaalflow klaar",
                    "betaalflows klaar",
                  )
                : "Nog niet gekoppeld"
            }
            description="Koppel Mollie en bepaal welke betaalflows live zijn voor deze gym."
            disabled={!snapshot.uiCapabilities.canManagePayments}
            highlighted={isHighlighted("payments")}
            statusLabel={snapshot.payments.statusLabel}
            statusTone={
              !snapshot.uiCapabilities.canManagePayments
                ? "locked"
                : snapshot.payments.connectionStatus === "configured" &&
                    snapshot.payments.enabled
                  ? "complete"
                  : snapshot.payments.connectionStatus === "attention"
                    ? "current"
                    : "upcoming"
            }
            title="Betalingen koppelen"
          >
            {!snapshot.uiCapabilities.canManagePayments ? (
              <p className="text-muted text-sm">
                Alleen de eigenaar kan betaalproviders koppelen of live betaalflows starten.
              </p>
            ) : (
              <form
                className="section-stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  runAction(async () => {
                    const payments = await submitJson<GymDashboardSnapshot["payments"]>(
                      "/api/platform/billing",
                      {
                        enabled: billingEnabled,
                        provider: billingProvider,
                        profileLabel: billingProfileLabel,
                        profileId: billingProfileId,
                        settlementLabel: billingSettlementLabel,
                        supportEmail: billingSupportEmail,
                        paymentMethods: billingPaymentMethods,
                        notes: billingNotes || undefined,
                      },
                    );

                    toast.success(
                      `${payments.providerLabel} opgeslagen voor ${payments.profileLabel}.`,
                    );
                  });
                }}
              >
                <Card className="rounded-2xl border-border/70 bg-surface-secondary">
                  <Card.Content className="space-y-2">
                    <p className="font-medium">Betaalstatus</p>
                    <p className="text-muted text-sm leading-6">
                      {snapshot.payments.helpText}
                    </p>
                  </Card.Content>
                </Card>

                <Card className="rounded-2xl border-border/70 bg-surface-secondary">
                  <Card.Header className="items-start justify-between gap-4">
                    <div className="space-y-2">
                      <Card.Title>Mollie Connect</Card.Title>
                      <Card.Description>
                        OAuth-koppeling in testmodus met scopes voor betalingen, incasso, subscriptions, payment links en reconciliatie.
                      </Card.Description>
                    </div>
                    <Chip
                      color={snapshot.payments.mollieConnectConnected ? "success" : "default"}
                      size="sm"
                      variant={snapshot.payments.mollieConnectConnected ? "soft" : "tertiary"}
                    >
                      {snapshot.payments.mollieConnectConnected
                        ? snapshot.payments.mollieConnectTestMode
                          ? "Test gekoppeld"
                          : "Live gekoppeld"
                        : "Niet gekoppeld"}
                    </Chip>
                  </Card.Header>
                  <Card.Content className="section-stack">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-border/70 bg-surface px-4 py-3">
                        <p className="text-sm font-medium">Bestaand Mollie-account</p>
                        <p className="text-muted mt-1 text-sm leading-6">
                          Koppel de gym via OAuth. Bestaande SEPA-mandates uit hetzelfde Mollie-account kunnen daarna gecontroleerd worden voor migratie.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-surface px-4 py-3">
                        <p className="text-sm font-medium">Nieuwe Mollie-klant</p>
                        <p className="text-muted mt-1 text-sm leading-6">
                          Maak een Client Link zodat de gym Mollie-onboarding met GymOS-context kan afronden.
                        </p>
                      </div>
                    </div>
                    <p className="text-muted text-sm leading-6">
                      {snapshot.payments.mollieConnectMigrationHint}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        isDisabled={isPending || !snapshot.payments.mollieConnectClientConfigured}
                        type="button"
                        variant="outline"
                        onPress={() => {
                          window.location.href = "/api/platform/billing/mollie/connect";
                        }}
                      >
                        Bestaand account koppelen
                      </Button>
                      {snapshot.payments.mollieConnectOnboardingUrl ? (
                        <Button
                          type="button"
                          variant="outline"
                          onPress={() =>
                            window.open(
                              snapshot.payments.mollieConnectOnboardingUrl,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                        >
                          Laatste onboarding openen
                        </Button>
                      ) : null}
                      <Button
                        isDisabled={isPending || !snapshot.payments.mollieConnectConnected}
                        type="button"
                        variant="outline"
                        onPress={() =>
                          runAction(async () => {
                            const preview = await submitJson<{
                              reusableMandates: number;
                              totalMandates: number;
                            }>("/api/platform/billing/mollie/mandates", {});

                            toast.success(
                              `${preview.reusableMandates} van ${preview.totalMandates} Mollie-mandates zijn direct herbruikbaar.`,
                            );
                          })
                        }
                      >
                        SEPA mandates scannen
                      </Button>
                      <Button
                        isDisabled={isPending || !snapshot.payments.mollieConnectConnected}
                        type="button"
                        variant="danger"
                        onPress={() => {
                          if (!window.confirm("Mollie-koppeling verwijderen?")) {
                            return;
                          }

                          runAction(async () => {
                            await submitJson(
                              "/api/platform/billing/mollie/disconnect",
                              {},
                            );
                            toast.success("Mollie-koppeling verwijderd.");
                          });
                        }}
                      >
                        Koppeling verwijderen
                      </Button>
                    </div>
                  </Card.Content>
                </Card>

                <Switch isSelected={billingEnabled} onChange={setBillingEnabled}>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Switch.Content>
                    <Label>Betalingen actief voor deze gym</Label>
                  </Switch.Content>
                </Switch>

                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField
                    label="Provider"
                    options={BILLING_PROVIDER_OPTIONS.map((provider) => ({
                      value: provider.key,
                      label: provider.label,
                    }))}
                    value={billingProvider}
                    onChange={(value) => setBillingProvider(value as typeof billingProvider)}
                  />
                  <Field label="Profielnaam">
                    <Input fullWidth placeholder="Atlas Forge Payments" value={billingProfileLabel} onChange={(event) => setBillingProfileLabel(event.target.value)} />
                  </Field>
                  <Field label="Mollie profiel-ID">
                    <Input fullWidth placeholder="pfl_live_..." value={billingProfileId} onChange={(event) => setBillingProfileId(event.target.value)} />
                  </Field>
                  <Field label="Uitbetalingslabel">
                    <Input fullWidth placeholder="Atlas Forge Club" value={billingSettlementLabel} onChange={(event) => setBillingSettlementLabel(event.target.value)} />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Support e-mail">
                      <Input fullWidth placeholder="billing@jouwgym.nl" type="email" value={billingSupportEmail} onChange={(event) => setBillingSupportEmail(event.target.value)} />
                    </Field>
                  </div>
                </div>

                <div className="section-stack rounded-2xl border border-border/70 bg-surface-secondary px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium">Betaalflows</p>
                    <Chip size="sm" variant="tertiary">
                      {billingPaymentMethods.length} geselecteerd
                    </Chip>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {BILLING_PAYMENT_METHOD_OPTIONS.map((paymentMethod) => {
                      const active = billingPaymentMethods.includes(paymentMethod.key);

                      return (
                        <Button
                          key={paymentMethod.key}
                          type="button"
                          variant={active ? "primary" : "outline"}
                          onPress={() => toggleBillingMethod(paymentMethod.key)}
                        >
                          {paymentMethod.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <Field label="Notities">
                  <TextArea fullWidth rows={4} placeholder="eerst lidmaatschappen via incasso, intro via betaalverzoek" value={billingNotes} onChange={(event) => setBillingNotes(event.target.value)} />
                </Field>

                <Card className="rounded-2xl border-border/70 bg-surface-secondary">
                  <Card.Header>
                    <Card.Title>Mollie klant onboarden</Card.Title>
                    <Card.Description>
                      Gebruik dit wanneer een gym nog geen Mollie-account heeft. De link opent Mollie in testmodus.
                    </Card.Description>
                  </Card.Header>
                  <Card.Content className="grid gap-4 md:grid-cols-2">
                    <Field label="Organisatienaam">
                      <Input fullWidth value={mollieClientName} onChange={(event) => setMollieClientName(event.target.value)} />
                    </Field>
                    <Field label="E-mail">
                      <Input fullWidth type="email" value={mollieClientEmail} onChange={(event) => setMollieClientEmail(event.target.value)} />
                    </Field>
                    <Field label="Straat en nummer">
                      <Input fullWidth value={mollieClientStreet} onChange={(event) => setMollieClientStreet(event.target.value)} />
                    </Field>
                    <Field label="Postcode">
                      <Input fullWidth value={mollieClientPostalCode} onChange={(event) => setMollieClientPostalCode(event.target.value)} />
                    </Field>
                    <Field label="Plaats">
                      <Input fullWidth value={mollieClientCity} onChange={(event) => setMollieClientCity(event.target.value)} />
                    </Field>
                    <Field label="Landcode">
                      <Input fullWidth maxLength={2} value={mollieClientCountry} onChange={(event) => setMollieClientCountry(event.target.value.toUpperCase())} />
                    </Field>
                    <Field label="KvK-nummer">
                      <Input fullWidth value={mollieClientRegistrationNumber} onChange={(event) => setMollieClientRegistrationNumber(event.target.value)} />
                    </Field>
                    <Field label="BTW-nummer">
                      <Input fullWidth value={mollieClientVatNumber} onChange={(event) => setMollieClientVatNumber(event.target.value)} />
                    </Field>
                    <Field label="Rechtsvorm">
                      <Input fullWidth value={mollieClientLegalEntity} onChange={(event) => setMollieClientLegalEntity(event.target.value)} />
                    </Field>
                    <Field label="Registratiekantoor">
                      <Input fullWidth value={mollieClientRegistrationOffice} onChange={(event) => setMollieClientRegistrationOffice(event.target.value)} />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Oprichtingsdatum">
                        <Input fullWidth placeholder="YYYY-MM-DD" value={mollieClientIncorporationDate} onChange={(event) => setMollieClientIncorporationDate(event.target.value)} />
                      </Field>
                    </div>
                  </Card.Content>
                  <Card.Footer className="justify-end">
                    <Button
                      isDisabled={
                        isPending ||
                        !snapshot.payments.mollieClientLinksConfigured ||
                        !mollieClientName ||
                        !mollieClientEmail ||
                        !mollieClientStreet ||
                        !mollieClientPostalCode ||
                        !mollieClientCity ||
                        !mollieClientCountry ||
                        !mollieClientLegalEntity ||
                        !mollieClientRegistrationOffice
                      }
                      type="button"
                      variant="outline"
                      onPress={() =>
                        runAction(async () => {
                          const receipt = await submitJson<{
                            onboardingUrl: string;
                          }>("/api/platform/billing/mollie/client-link", {
                            owner: {
                              name: mollieClientName,
                              email: mollieClientEmail,
                              address: {
                                streetAndNumber: mollieClientStreet,
                                postalCode: mollieClientPostalCode,
                                city: mollieClientCity,
                                country: mollieClientCountry,
                              },
                              registrationNumber:
                                mollieClientRegistrationNumber || null,
                              vatNumber: mollieClientVatNumber || null,
                              legalEntity: mollieClientLegalEntity,
                              registrationOffice: mollieClientRegistrationOffice,
                              incorporationDate:
                                mollieClientIncorporationDate || null,
                            },
                          });

                          toast.success("Mollie onboardinglink aangemaakt.");
                          window.open(receipt.onboardingUrl, "_blank", "noopener,noreferrer");
                        })
                      }
                    >
                      Client Link maken
                    </Button>
                  </Card.Footer>
                </Card>

                <Card className="rounded-2xl border-border/70 bg-surface-secondary">
                  <Card.Header>
                    <Card.Title>Live betaalflow testen</Card.Title>
                    <Card.Description>
                      Maak een echte Mollie betaallink aan en controleer de checkout voordat leden deze gebruiken.
                    </Card.Description>
                  </Card.Header>
                  <Card.Content className="grid gap-4 md:grid-cols-2">
                    <SelectField
                      label="Flow"
                      options={billingPaymentMethods.map((paymentMethod) => ({
                        value: paymentMethod,
                        label:
                          BILLING_PAYMENT_METHOD_OPTIONS.find(
                            (option) => option.key === paymentMethod,
                          )?.label ?? paymentMethod,
                      }))}
                      value={billingPreviewMethod}
                      onChange={(value) => setBillingPreviewMethod(value as typeof billingPreviewMethod)}
                    />
                    <Field label="Bedrag in centen">
                      <Input fullWidth min={100} step={5} type="number" value={billingPreviewAmount} onChange={(event) => setBillingPreviewAmount(event.target.value)} />
                    </Field>
                    <Field label="Omschrijving">
                      <Input fullWidth placeholder="Intakepakket" value={billingPreviewDescription} onChange={(event) => setBillingPreviewDescription(event.target.value)} />
                    </Field>
                    <Field label="Lidnaam">
                      <Input fullWidth placeholder="Optioneel" value={billingPreviewMemberName} onChange={(event) => setBillingPreviewMemberName(event.target.value)} />
                    </Field>
                  </Card.Content>
                </Card>

                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    isDisabled={isPending || billingPaymentMethods.length === 0}
                    type="submit"
                  >
                    {isPending ? "Opslaan..." : "Betalingen opslaan"}
                  </Button>
                  <Button
                    isDisabled={
                      isPending ||
                      !snapshot.payments.enabled ||
                      snapshot.payments.connectionStatus !== "configured" ||
                      billingPaymentMethods.length === 0
                    }
                    type="button"
                    variant="outline"
                    onPress={() =>
                      runAction(async () => {
                        const receipt = await submitJson<{
                          summary: string;
                          checkoutUrl?: string;
                        }>(
                          "/api/platform/billing/preview",
                          {
                            paymentMethod: billingPreviewMethod,
                            amountCents: Number(billingPreviewAmount),
                            currency: "EUR",
                            description: billingPreviewDescription,
                            memberName: billingPreviewMemberName || undefined,
                          },
                        );

                        toast.success(receipt.summary);
                        if (receipt.checkoutUrl) {
                          window.open(receipt.checkoutUrl, "_blank", "noopener,noreferrer");
                        }
                      })
                    }
                  >
                    Live link maken
                  </Button>
                </div>
              </form>
            )}
          </SectionCard>
        ) : null}

        {shouldShowSection("legal") ? (
          <SectionCard
            countLabel={snapshot.legal.statusLabel}
            description="Leg voorwaarden, privacy, SEPA-machtiging, contracttemplate en waiver-bewaartermijn vast voordat betalingen live gaan."
            highlighted={isHighlighted("legal")}
            statusLabel={snapshot.legal.statusLabel}
            statusTone={
              snapshot.legal.statusLabel === "Juridisch klaar" ? "complete" : "current"
            }
            title="Juridische instellingen"
          >
            <form
              className="section-stack"
              onSubmit={(event) => {
                event.preventDefault();
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
              <Card className="rounded-2xl border-border/70 bg-surface-secondary">
                <Card.Content>
                  <p className="text-muted text-sm leading-6">{snapshot.legal.helpText}</p>
                </Card.Content>
              </Card>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Algemene voorwaarden URL">
                  <Input fullWidth placeholder="https://jouwgym.nl/voorwaarden" value={legalTermsUrl} onChange={(event) => setLegalTermsUrl(event.target.value)} />
                </Field>
                <Field label="Privacyverklaring URL">
                  <Input fullWidth placeholder="https://jouwgym.nl/privacy" value={legalPrivacyUrl} onChange={(event) => setLegalPrivacyUrl(event.target.value)} />
                </Field>
                <Field label="SEPA creditor ID">
                  <Input fullWidth placeholder="NL00ZZZ..." value={legalSepaCreditorId} onChange={(event) => setLegalSepaCreditorId(event.target.value)} />
                </Field>
                <Field label="Contract-PDF template key">
                  <Input fullWidth placeholder="contracts/templates/membership-v1.pdf" value={legalContractPdfTemplateKey} onChange={(event) => setLegalContractPdfTemplateKey(event.target.value)} />
                </Field>
                <Field label="Waiver opslagpad">
                  <Input fullWidth placeholder="waivers/signed/" value={legalWaiverStorageKey} onChange={(event) => setLegalWaiverStorageKey(event.target.value)} />
                </Field>
                <Field label="Waiver bewaartermijn maanden">
                  <Input fullWidth min={1} type="number" value={legalWaiverRetentionMonths} onChange={(event) => setLegalWaiverRetentionMonths(event.target.value)} />
                </Field>
              </div>
              <Field label="SEPA machtigingstekst">
                <TextArea fullWidth rows={6} value={legalSepaMandateText} onChange={(event) => setLegalSepaMandateText(event.target.value)} />
              </Field>
              <div className="flex justify-end">
                <Button isDisabled={isPending} type="submit">
                  {isPending ? "Opslaan..." : "Juridische instellingen opslaan"}
                </Button>
              </div>
            </form>
          </SectionCard>
        ) : null}
      </div>
    </section>
  );
}
