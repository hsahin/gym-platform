"use client";

import {
  useEffect,
  useState,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Card, Chip, Input, Label, Tooltip } from "@heroui/react";
import { DataGrid, type DataGridColumn } from "@/components/dashboard/HydrationSafeDataGrid";
import { Button } from "@/components/dashboard/HydrationSafeButton";
import { NativeSelect } from "@/components/dashboard/HydrationSafeNativeSelect";
import { Segment } from "@/components/dashboard/HydrationSafeSegment";
import { toast } from "sonner";
import { submitDashboardMutation } from "@/components/dashboard/dashboard-client-helpers";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import { LazyPlatformWorkbench } from "@/components/dashboard/LazyPlatformWorkbench";
import {
  DisabledActionReason,
  PageSection,
  formatDate,
  type DashboardPageProps,
} from "@/components/dashboard/shared";
import {
  getBillingInvoiceSourceLabel,
  getBillingInvoiceStatusLabel,
  getBillingPaymentMethodLabel,
  getBillingWebhookStatusLabel,
  getCollectionCaseStatusLabel,
  getPointOfSaleModeLabel,
} from "@/lib/ui-labels";
import { formatEuroFromCents, parseEuroInputToCents } from "@/lib/currency";

const billingWorkbenchTabs = [
  { id: "invoice-draft", label: "Factuur klaarzetten" },
  { id: "payment-requests", label: "Lopende betaalverzoeken" },
  { id: "receipts", label: "Ontvangsten" },
  { id: "daily-control", label: "Dagcontrole" },
] as const;

type BillingWorkbenchTab = (typeof billingWorkbenchTabs)[number]["id"];

function formatMissingFields(fields: ReadonlyArray<string>) {
  if (fields.length === 0) {
    return "";
  }

  if (fields.length === 1) {
    return fields[0]!;
  }

  return `${fields.slice(0, -1).join(", ")} en ${fields.at(-1)}`;
}

function ActionButton({
  helpTitle,
  helpDescription,
  children,
  ...props
}: ComponentProps<typeof Button> & {
  readonly helpTitle?: string;
  readonly helpDescription?: string;
}) {
  const button = <Button {...props}>{children}</Button>;

  if (!helpDescription) {
    return button;
  }

  return (
    <Tooltip delay={200}>
      <Tooltip.Trigger>
        <span className="inline-flex">{button}</span>
      </Tooltip.Trigger>
      <Tooltip.Content className="max-w-sm rounded-2xl border border-border/70 bg-surface p-4 text-left shadow-overlay">
        <Tooltip.Arrow />
        <div className="space-y-1">
          {helpTitle ? <p className="text-sm font-semibold">{helpTitle}</p> : null}
          <p className="text-muted text-sm leading-6">{helpDescription}</p>
        </div>
      </Tooltip.Content>
    </Tooltip>
  );
}

function ActionCluster({ children }: { readonly children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

type MollieStepStatus = "done" | "current" | "todo";

function MollieStatusChip({ status }: { readonly status: MollieStepStatus }) {
  if (status === "done") {
    return (
      <Chip color="success" size="sm" variant="soft">
        Klaar
      </Chip>
    );
  }
  if (status === "current") {
    return (
      <Chip color="accent" size="sm" variant="soft">
        Volgende stap
      </Chip>
    );
  }
  return (
    <Chip color="default" size="sm" variant="tertiary">
      Nog te doen
    </Chip>
  );
}

function MollieSetupStepper({
  snapshot,
}: {
  readonly snapshot: DashboardPageProps["snapshot"];
}) {
  const connected = snapshot.payments.mollieConnectConnected;
  const routes = snapshot.payments.paymentMethods;
  const supportFilled = snapshot.payments.supportEmail.trim().length > 0;
  const settlementFilled = snapshot.payments.settlementLabel.trim().length > 0;
  const profileReady = supportFilled && settlementFilled;
  const liveReady = snapshot.payments.enabled;

  const steps: Array<{
    readonly title: string;
    readonly description: string;
    readonly status: MollieStepStatus;
    readonly summary: ReactNode;
  }> = [
    {
      title: "1. Mollie koppelen",
      description:
        "Veilig inloggen bij Mollie. GymOS krijgt alleen toegang om betalingen voor deze gym te verwerken.",
      status: connected ? "done" : "current",
      summary: connected ? (
        <p className="text-muted text-sm leading-6">
          Gekoppeld {snapshot.payments.mollieConnectTestMode ? "in testmodus" : "live"}
          {snapshot.payments.profileLabel
            ? ` op profiel ${snapshot.payments.profileLabel}`
            : ""}
          .
        </p>
      ) : (
        <p className="text-muted text-sm leading-6">
          Klik op <strong>Betaalgegevens veilig koppelen</strong> in de werkbank
          hieronder. Daarna log je veilig in bij Mollie en kom je hier terug.
        </p>
      ),
    },
    {
      title: "2. Betaalroutes kiezen",
      description:
        "Bepaal hoe leden mogen betalen: automatische incasso, eenmalige betaling of betaalverzoek.",
      status: !connected
        ? "todo"
        : routes.length > 0
          ? "done"
          : "current",
      summary:
        routes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {routes.map((method) => (
              <Chip key={method} size="sm" variant="soft">
                {getBillingPaymentMethodLabel(method)}
              </Chip>
            ))}
          </div>
        ) : (
          <p className="text-muted text-sm leading-6">
            Vink in de werkbank hieronder minstens één betaalroute aan. Zonder
            route kan een lid online geen lidmaatschap afnemen.
          </p>
        ),
    },
    {
      title: "3. Profielgegevens invullen",
      description:
        "Vul supportmail, uitbetalingslabel en eventueel een notitie zodat leden weten met wie ze te maken hebben.",
      status: !connected || routes.length === 0
        ? "todo"
        : profileReady
          ? "done"
          : "current",
      summary: profileReady ? (
        <p className="text-muted text-sm leading-6">
          Supportmail{" "}
          <span className="text-foreground font-medium">
            {snapshot.payments.supportEmail}
          </span>{" "}
          · Uitbetalingslabel{" "}
          <span className="text-foreground font-medium">
            {snapshot.payments.settlementLabel}
          </span>
          .
        </p>
      ) : (
        <ul className="text-muted ml-4 list-disc text-sm leading-6">
          {!supportFilled ? <li>Supportmail nog niet ingevuld.</li> : null}
          {!settlementFilled ? <li>Uitbetalingslabel nog niet ingevuld.</li> : null}
        </ul>
      ),
    },
    {
      title: "4. Betalingen activeren",
      description:
        "De finale knop. Pas hierna verwerken leden echt betalingen via Mollie.",
      status:
        !connected || routes.length === 0 || !profileReady
          ? "todo"
          : liveReady
            ? "done"
            : "current",
      summary: liveReady ? (
        <p className="text-muted text-sm leading-6">
          Online betalingen staan <span className="text-success font-semibold">live</span>{" "}
          voor deze gym.
        </p>
      ) : (
        <p className="text-muted text-sm leading-6">
          Zet de schakelaar <strong>Betalingen actief voor deze gym</strong> aan
          in de werkbank zodra alle drie de stappen hierboven groen zijn.
        </p>
      ),
    },
  ];

  const doneCount = steps.filter((step) => step.status === "done").length;

  return (
    <Card className="border-border/80 bg-surface rounded-2xl border shadow-none">
      <Card.Header className="items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Card.Title>Mollie-status</Card.Title>
            <Chip
              color={
                doneCount === steps.length
                  ? "success"
                  : doneCount === 0
                    ? "default"
                    : "accent"
              }
              size="sm"
              variant="soft"
            >
              {doneCount} van {steps.length} klaar
            </Chip>
          </div>
          <Card.Description>
            {doneCount === steps.length
              ? "Alles staat klaar. Leden kunnen via Mollie betalen."
              : "Werk de stappen één voor één af. De werkbank onderaan opent precies de juiste actie."}
          </Card.Description>
        </div>
      </Card.Header>
      <Card.Content className="grid gap-3 md:grid-cols-2">
        {steps.map((step) => (
          <div
            key={step.title}
            className={`min-w-0 rounded-2xl border p-4 transition ${
              step.status === "done"
                ? "border-success/40 bg-success/5"
                : step.status === "current"
                  ? "border-accent/60 bg-accent/5 shadow-sm"
                  : "border-border/60 bg-surface-secondary"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-foreground text-sm font-semibold">{step.title}</p>
                <p className="text-muted mt-1 text-xs leading-5">{step.description}</p>
              </div>
              <MollieStatusChip status={step.status} />
            </div>
            <div className="mt-3 min-w-0">{step.summary}</div>
          </div>
        ))}
      </Card.Content>
    </Card>
  );
}

export function PaymentsDashboardPage({ snapshot }: DashboardPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [billingWorkbenchTab, setBillingWorkbenchTab] =
    useState<BillingWorkbenchTab>("invoice-draft");
  const paymentFeatures = snapshot.featureFlags.filter(
    (feature) => feature.dashboardPage === "payments",
  );
  const [webshopCollectionName, setWebshopCollectionName] = useState(
    snapshot.revenueWorkspace.webshopCollectionName,
  );
  const [pointOfSaleMode, setPointOfSaleMode] = useState(
    snapshot.revenueWorkspace.pointOfSaleMode,
  );
  const [cardTerminalLabel, setCardTerminalLabel] = useState(
    snapshot.revenueWorkspace.cardTerminalLabel,
  );
  const [autocollectPolicy, setAutocollectPolicy] = useState(
    snapshot.revenueWorkspace.autocollectPolicy,
  );
  const [directDebitLeadDays, setDirectDebitLeadDays] = useState(
    snapshot.revenueWorkspace.directDebitLeadDays,
  );
  const [selectedCollectionMemberId, setSelectedCollectionMemberId] = useState(
    snapshot.members[0]?.id ?? "",
  );
  const [collectionMemberName, setCollectionMemberName] = useState(
    snapshot.members[0]?.fullName ?? "",
  );
  const [collectionPaymentMethod, setCollectionPaymentMethod] = useState<
    "direct_debit" | "one_time" | "payment_request" | "cash" | "bank_transfer"
  >("direct_debit");
  const [collectionStatus, setCollectionStatus] = useState<
    "open" | "retrying" | "resolved" | "cancelled"
  >("open");
  const [collectionAmountInput, setCollectionAmountInput] = useState(
    formatEuroFromCents(0),
  );
  const [collectionReason, setCollectionReason] = useState("");
  const [collectionDueAt, setCollectionDueAt] = useState("2026-05-01T09:00:00.000Z");
  const [collectionNotes, setCollectionNotes] = useState("");
  const [invoiceMemberId, setInvoiceMemberId] = useState(snapshot.members[0]?.id ?? "");
  const [invoiceMemberName, setInvoiceMemberName] = useState(
    snapshot.members[0]?.fullName ?? "",
  );
  const [invoiceDescription, setInvoiceDescription] = useState("Lidmaatschap factuur");
  const [invoiceAmountInput, setInvoiceAmountInput] = useState(formatEuroFromCents(0));
  const [invoiceDueAt, setInvoiceDueAt] = useState("2026-05-01T08:00:00.000Z");
  const [invoiceSource, setInvoiceSource] = useState<
    "membership" | "signup_checkout" | "appointment_pack" | "late_fee" | "manual"
  >("membership");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(
    snapshot.billingBackoffice.invoices[0]?.id ?? "",
  );
  const [paymentOutcome, setPaymentOutcome] = useState("betaling ontvangen");
  const [paymentUpdateStatus, setPaymentUpdateStatus] = useState<
    "received" | "processed" | "failed"
  >("processed");
  const [providerReference, setProviderReference] = useState("betaling-123");
  const [payloadSummary, setPayloadSummary] = useState("Betaling goed verwerkt");
  const [refundAmountInput, setRefundAmountInput] = useState(formatEuroFromCents(0));
  const [refundReason, setRefundReason] = useState("Terugbetaling");
  const [dailyControlNote, setDailyControlNote] = useState(
    "Controle van ontvangen betalingen",
  );
  const collectionAmountCents = parseEuroInputToCents(collectionAmountInput);
  const invoiceAmountCents = parseEuroInputToCents(invoiceAmountInput);
  const refundAmountCents = parseEuroInputToCents(refundAmountInput);

  // ------------------------------------------------------------------
  // Derived data for the overview hero: cash KPIs, per-member instalment
  // tracker, action queue and activity feed. Computed locally so we don't
  // need a new snapshot field — everything is already in the snapshot.
  // ------------------------------------------------------------------
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const planById = new Map(
    snapshot.membershipPlans.map((plan) => [plan.id, plan] as const),
  );
  const invoicesByMember = new Map<
    string,
    Array<(typeof snapshot.billingBackoffice.invoices)[number]>
  >();
  for (const invoice of snapshot.billingBackoffice.invoices) {
    if (!invoice.memberId) {
      continue;
    }
    const bucket = invoicesByMember.get(invoice.memberId);
    if (bucket) {
      bucket.push(invoice);
    } else {
      invoicesByMember.set(invoice.memberId, [invoice]);
    }
  }
  const activeMembers = snapshot.members.filter(
    (member) => member.status === "active",
  );
  const trialMembers = snapshot.members.filter(
    (member) => member.status === "trial",
  );
  const monthlyRecurringRevenueCents = activeMembers.reduce((total, member) => {
    const plan = planById.get(member.membershipPlanId);
    if (!plan) {
      return total;
    }
    return total + Math.round(plan.priceMonthly * 100);
  }, 0);
  const receivedThisMonthCents = snapshot.billingBackoffice.invoices.reduce(
    (total, invoice) => {
      if (invoice.status !== "paid" || !invoice.paidAt) {
        return total;
      }
      const paidAt = new Date(invoice.paidAt);
      if (paidAt < monthStart || paidAt > now) {
        return total;
      }
      return total + invoice.amountCents;
    },
    0,
  );
  const outstandingInvoices = snapshot.billingBackoffice.invoices.filter(
    (invoice) => invoice.status === "open" || invoice.status === "draft",
  );
  const outstandingCents = outstandingInvoices.reduce(
    (total, invoice) => total + invoice.amountCents,
    0,
  );
  const failedInvoices = snapshot.billingBackoffice.invoices.filter(
    (invoice) => invoice.status === "failed",
  );
  const failedCents = failedInvoices.reduce(
    (total, invoice) => total + invoice.amountCents,
    0,
  );
  const refundedThisMonthCents = snapshot.billingBackoffice.refunds.reduce(
    (total, refund) => {
      const ts = refund.processedAt ?? refund.requestedAt;
      const at = new Date(ts);
      if (at < monthStart || at > now) {
        return total;
      }
      return total + refund.amountCents;
    },
    0,
  );

  const billingCycleLabel: Record<string, string> = {
    monthly: "Maandelijks",
    semiannual: "Halfjaarlijks",
    annual: "Jaarcontract",
  };

  type MemberInstalment = {
    readonly memberId: string;
    readonly memberName: string;
    readonly planName: string;
    readonly cycleLabel: string;
    readonly monthlyPriceCents: number;
    readonly status: string;
    readonly joinedAt: string;
    readonly nextRenewalAt: string;
    readonly paidCount: number;
    readonly openCount: number;
    readonly failedCount: number;
    readonly paidCents: number;
    readonly outstandingCents: number;
    readonly lastInvoiceAt: string | null;
    readonly needsAttention: boolean;
  };

  const memberInstalments: MemberInstalment[] = snapshot.members
    .filter((member) => member.status === "active" || member.status === "trial")
    .map((member) => {
      const plan = planById.get(member.membershipPlanId);
      const invoices = invoicesByMember.get(member.id) ?? [];
      const paid = invoices.filter((invoice) => invoice.status === "paid");
      const open = invoices.filter(
        (invoice) => invoice.status === "open" || invoice.status === "draft",
      );
      const failed = invoices.filter((invoice) => invoice.status === "failed");
      const lastInvoiceAt =
        invoices.length > 0
          ? invoices
              .map((invoice) => invoice.issuedAt)
              .sort((a, b) => b.localeCompare(a))[0]!
          : null;

      return {
        memberId: member.id,
        memberName: member.fullName,
        planName: plan?.name ?? "Onbekend plan",
        cycleLabel: plan ? billingCycleLabel[plan.billingCycle] ?? plan.billingCycle : "—",
        monthlyPriceCents: plan ? Math.round(plan.priceMonthly * 100) : 0,
        status: member.status,
        joinedAt: member.joinedAt,
        nextRenewalAt: member.nextRenewalAt,
        paidCount: paid.length,
        openCount: open.length,
        failedCount: failed.length,
        paidCents: paid.reduce((total, invoice) => total + invoice.amountCents, 0),
        outstandingCents: open.reduce(
          (total, invoice) => total + invoice.amountCents,
          0,
        ),
        lastInvoiceAt,
        needsAttention: failed.length > 0 || open.length > 0,
      };
    })
    .sort((left, right) => {
      if (left.needsAttention !== right.needsAttention) {
        return left.needsAttention ? -1 : 1;
      }
      return left.memberName.localeCompare(right.memberName, "nl");
    });

  const memberInstalmentColumns: DataGridColumn<MemberInstalment>[] = [
    {
      id: "memberName",
      header: "Lid",
      accessorKey: "memberName",
      allowsSorting: true,
      isRowHeader: true,
      minWidth: 220,
      pinned: "start",
      cell: (row) => (
        <span className="grid min-w-0 gap-1">
          <span className="truncate font-medium">{row.memberName}</span>
          <span className="text-muted truncate text-xs">
            {row.planName} · {row.cycleLabel}
          </span>
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      allowsSorting: true,
      minWidth: 120,
      cell: (row) => (
        <Chip
          color={
            row.needsAttention
              ? "warning"
              : row.status === "active"
                ? "success"
                : "default"
          }
          size="sm"
          variant="soft"
        >
          {row.needsAttention
            ? `${row.failedCount + row.openCount} open`
            : row.status === "active"
              ? "Loopt"
              : "Proef"}
        </Chip>
      ),
    },
    {
      id: "paidCount",
      header: "Betaalde termijnen",
      accessorKey: "paidCount",
      align: "end",
      allowsSorting: true,
      minWidth: 150,
      cell: (row) => (
        <span className="grid min-w-0 gap-0.5">
          <span className="text-foreground tabular-nums font-medium">
            {row.paidCount} voldaan
          </span>
          <span className="text-muted text-xs">
            {row.openCount > 0
              ? `${row.openCount} open`
              : row.failedCount > 0
                ? `${row.failedCount} mislukt`
                : "Op koers"}
          </span>
        </span>
      ),
    },
    {
      id: "paidCents",
      header: "Totaal betaald",
      accessorKey: "paidCents",
      align: "end",
      allowsSorting: true,
      minWidth: 130,
      cell: (row) => (
        <span className="tabular-nums">{formatEuroFromCents(row.paidCents)}</span>
      ),
    },
    {
      id: "outstandingCents",
      header: "Openstaand",
      accessorKey: "outstandingCents",
      align: "end",
      allowsSorting: true,
      minWidth: 130,
      cell: (row) => (
        <span
          className={`tabular-nums ${
            row.outstandingCents > 0 ? "text-warning font-semibold" : "text-muted"
          }`}
        >
          {formatEuroFromCents(row.outstandingCents)}
        </span>
      ),
    },
    {
      id: "nextRenewalAt",
      header: "Volgende incasso",
      accessorKey: "nextRenewalAt",
      allowsSorting: true,
      minWidth: 150,
      cell: (row) => (
        <span className="text-foreground text-sm">{formatDate(row.nextRenewalAt)}</span>
      ),
    },
    {
      id: "monthlyPriceCents",
      header: "Per termijn",
      accessorKey: "monthlyPriceCents",
      align: "end",
      allowsSorting: true,
      minWidth: 120,
      cell: (row) => (
        <span className="text-muted tabular-nums text-sm">
          {row.monthlyPriceCents > 0 ? formatEuroFromCents(row.monthlyPriceCents) : "—"}
        </span>
      ),
    },
  ];

  const actionQueueInvoices = snapshot.billingBackoffice.invoices
    .filter((invoice) => invoice.status === "failed" || invoice.retryCount >= 2)
    .sort((left, right) => right.retryCount - left.retryCount)
    .slice(0, 6);

  const activityFeed = [
    ...snapshot.billingBackoffice.webhooks.map((event) => ({
      id: event.id,
      timestamp: event.receivedAt,
      title: event.eventType,
      detail: event.payloadSummary,
      chipLabel: getBillingWebhookStatusLabel(event.status),
      chipColor:
        event.status === "processed"
          ? "success"
          : event.status === "failed"
            ? "danger"
            : "default",
    })),
    ...snapshot.billingBackoffice.refunds.map((refund) => ({
      id: `refund-${refund.id}`,
      timestamp: refund.processedAt ?? refund.requestedAt,
      title: "Terugbetaling",
      detail: `${formatEuroFromCents(refund.amountCents)} — ${refund.reason}`,
      chipLabel:
        refund.status === "processed"
          ? "Verwerkt"
          : refund.status === "failed"
            ? "Mislukt"
            : "In behandeling",
      chipColor:
        refund.status === "processed"
          ? "success"
          : refund.status === "failed"
            ? "danger"
            : "warning",
    })),
  ]
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, 10);

  const heroKpis = [
    {
      label: "MRR",
      value: formatEuroFromCents(monthlyRecurringRevenueCents),
      helper: `${activeMembers.length} actieve leden · ${trialMembers.length} proef`,
    },
    {
      label: "Deze maand ontvangen",
      value: formatEuroFromCents(receivedThisMonthCents),
      helper: "Som betaalde facturen binnen deze maand.",
    },
    {
      label: "Openstaand",
      value: formatEuroFromCents(outstandingCents),
      helper: `${outstandingInvoices.length} open/draft factu${
        outstandingInvoices.length === 1 ? "ur" : "ren"
      }.`,
    },
    {
      label: "Mislukt",
      value: formatEuroFromCents(failedCents),
      helper:
        failedInvoices.length === 0
          ? "Geen mislukte betalingen."
          : `${failedInvoices.length} factu${
              failedInvoices.length === 1 ? "ur" : "ren"
            } vragen actie.`,
      tone: failedInvoices.length > 0 ? ("warning" as const) : undefined,
    },
    {
      label: "Terugbetaald deze maand",
      value: formatEuroFromCents(refundedThisMonthCents),
      helper: "Bedrag dat is teruggeboekt sinds de eerste van deze maand.",
    },
    {
      label: "Actieve abonnementen",
      value: String(activeMembers.length),
      helper: `${snapshot.members.length} leden in totaal.`,
    },
  ];

  useEffect(() => {
    setWebshopCollectionName(snapshot.revenueWorkspace.webshopCollectionName);
    setPointOfSaleMode(snapshot.revenueWorkspace.pointOfSaleMode);
    setCardTerminalLabel(snapshot.revenueWorkspace.cardTerminalLabel);
    setAutocollectPolicy(snapshot.revenueWorkspace.autocollectPolicy);
    setDirectDebitLeadDays(snapshot.revenueWorkspace.directDebitLeadDays);
    setSelectedCollectionMemberId(snapshot.members[0]?.id ?? "");
    setCollectionMemberName(snapshot.members[0]?.fullName ?? "");
    setInvoiceMemberId(snapshot.members[0]?.id ?? "");
    setInvoiceMemberName(snapshot.members[0]?.fullName ?? "");
    setSelectedInvoiceId(snapshot.billingBackoffice.invoices[0]?.id ?? "");
  }, [snapshot.billingBackoffice.invoices, snapshot.members, snapshot.revenueWorkspace]);

  const missingPaymentUpdateFields = [
    selectedInvoiceId ? null : "factuur",
    paymentOutcome.trim() ? null : "betaaluitkomst",
    providerReference.trim() ? null : "betalingskenmerk",
    payloadSummary.trim() ? null : "samenvatting",
    snapshot.payments.webhookUrlConfigured ? null : "Mollie-koppeling",
  ].filter((field): field is string => Boolean(field));
  const paymentUpdateDisabledReason = isPending
    ? "Even wachten: er loopt al een betaalactie."
    : missingPaymentUpdateFields.length > 0
      ? `Ontvangst bijwerken kan nog niet: vul ${formatMissingFields(missingPaymentUpdateFields)} in.`
      : null;
  const paymentRequestRows = [...snapshot.billingBackoffice.invoices];
  type PaymentRequestRow = (typeof snapshot.billingBackoffice.invoices)[number];
  const paymentRequestColumns: DataGridColumn<PaymentRequestRow>[] = [
    {
      id: "memberName",
      header: "Lid",
      accessorKey: "memberName",
      allowsSorting: true,
      isRowHeader: true,
      minWidth: 220,
      pinned: "start",
      cell: (invoice) => (
        <span className="grid min-w-0 gap-1">
          <span className="truncate font-medium">{invoice.memberName}</span>
          <span className="text-muted truncate text-xs">{invoice.description}</span>
        </span>
      ),
    },
    {
      id: "amountCents",
      header: "Bedrag",
      accessorKey: "amountCents",
      align: "end",
      allowsSorting: true,
      minWidth: 120,
      cell: (invoice) => (
        <span className="tabular-nums">{formatEuroFromCents(invoice.amountCents)}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      allowsSorting: true,
      minWidth: 140,
      cell: (invoice) => (
        <Chip size="sm" variant="soft">
          {getBillingInvoiceStatusLabel(invoice.status)}
        </Chip>
      ),
    },
    {
      id: "source",
      header: "Soort",
      accessorKey: "source",
      allowsSorting: true,
      minWidth: 160,
      cell: (invoice) => getBillingInvoiceSourceLabel(invoice.source),
    },
    {
      id: "dueAt",
      header: "Vervalt",
      accessorKey: "dueAt",
      allowsSorting: true,
      minWidth: 140,
      cell: (invoice) => formatDate(invoice.dueAt),
    },
    {
      id: "retryCount",
      header: "Pogingen",
      accessorKey: "retryCount",
      align: "end",
      allowsSorting: true,
      minWidth: 110,
      cell: (invoice) => <span className="tabular-nums">{invoice.retryCount}</span>,
    },
    {
      id: "checkoutUrl",
      header: "Betaallink",
      minWidth: 150,
      cell: (invoice) =>
        invoice.checkoutUrl ? (
          <Button
            size="sm"
            variant="outline"
            onPress={() =>
              window.open(invoice.checkoutUrl, "_blank", "noopener,noreferrer")
            }
          >
            Open betaallink
          </Button>
        ) : (
          <span className="text-muted text-sm">Geen link</span>
        ),
    },
    {
      id: "actions",
      header: "Acties",
      align: "end",
      minWidth: 280,
      pinned: "end",
      cell: (invoice) => (
        <ActionCluster>
          <ActionButton
            isDisabled={isPending}
            size="sm"
            variant="outline"
            helpTitle="Opnieuw proberen"
            helpDescription="Maakt voor deze factuur een nieuwe betaalmogelijkheid aan. Gebruik dit na een verlopen, geweigerde of gemiste betaling."
            onPress={() =>
              startTransition(async () => {
                try {
                  await submitDashboardMutation("/api/platform/billing-backoffice", {
                    operation: "retry_invoice",
                    invoiceId: invoice.id,
                    reason: "Nieuwe betaalpoging",
                  });
                  toast.success("Nieuwe betaalpoging ingepland.");
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Nieuwe betaalpoging mislukt.",
                  );
                }
              })
            }
          >
            Opnieuw proberen
          </ActionButton>
          <ActionButton
            isDisabled={isPending}
            size="sm"
            variant="ghost"
            helpTitle="Terugbetalen"
            helpDescription="Boekt geld terug naar het lid voor deze factuur. Gebruik dit alleen nadat het bedrag en de reden zijn gecontroleerd."
            onPress={() =>
              startTransition(async () => {
                try {
                  await submitDashboardMutation("/api/platform/billing-backoffice", {
                    operation: "refund_invoice",
                    invoiceId: invoice.id,
                    amountCents: refundAmountCents || invoice.amountCents,
                    reason: refundReason,
                  });
                  toast.success("Terugbetaling vastgelegd.");
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Terugbetaling mislukt.",
                  );
                }
              })
            }
          >
            Terugbetalen
          </ActionButton>
        </ActionCluster>
      ),
    },
  ];

  return (
    <div className="section-stack min-w-0 max-w-full overflow-x-clip">
        <PageSection
          title="Betalingen"
          description="Wat er nu binnenkomt, wat openstaat en welke betalingen je aandacht vragen."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {heroKpis.map((kpi) => (
              <Card
                key={kpi.label}
                className="border-border/80 bg-surface rounded-2xl border shadow-none"
              >
                <Card.Content className="space-y-2 p-5">
                  <p className="text-muted text-sm">{kpi.label}</p>
                  <p
                    className={`text-3xl font-semibold tabular-nums ${
                      kpi.tone === "warning" ? "text-warning" : "text-foreground"
                    }`}
                  >
                    {kpi.value}
                  </p>
                  <p className="text-muted text-sm leading-6">{kpi.helper}</p>
                </Card.Content>
              </Card>
            ))}
          </div>
        </PageSection>

        <PageSection
          title="Lidmaatschapsbetalingen"
          description="Per lid: aantal betaalde termijnen, openstaand bedrag en datum van de volgende incasso. Leden met openstaande of mislukte betalingen staan bovenaan."
        >
          {memberInstalments.length > 0 ? (
            <DataGrid
              allowsColumnResize
              aria-label="Lidmaatschapsbetalingen"
              className="rounded-2xl"
              columns={memberInstalmentColumns}
              contentClassName="min-w-[960px]"
              data={memberInstalments}
              defaultSortDescriptor={{ column: "memberName", direction: "ascending" }}
              getRowId={(row) => row.memberId}
              scrollContainerClassName="max-w-full overflow-x-auto"
              variant="primary"
            />
          ) : (
            <div className="border-border/80 bg-surface text-muted rounded-2xl border border-dashed px-4 py-8 text-center">
              <p className="text-foreground font-medium">Nog geen leden met lidmaatschap</p>
              <p className="mt-1 text-sm">
                Zodra je leden hebt verschijnen hier hun betaaltermijnen, totalen en openstaande bedragen.
              </p>
            </div>
          )}
        </PageSection>

        {actionQueueInvoices.length > 0 ? (
          <PageSection
            title="Actie nodig"
            description="Mislukte of vastgelopen betalingen die nu opvolging vragen."
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {actionQueueInvoices.map((invoice) => (
                <Card
                  key={invoice.id}
                  className="border-warning/40 bg-surface rounded-2xl border shadow-none"
                >
                  <Card.Content className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-foreground truncate font-semibold">
                          {invoice.memberName}
                        </p>
                        <p className="text-muted truncate text-xs">
                          {invoice.description}
                        </p>
                      </div>
                      <Chip color="warning" size="sm" variant="soft">
                        {getBillingInvoiceStatusLabel(invoice.status)}
                      </Chip>
                    </div>
                    <div className="text-muted grid gap-1 text-sm">
                      <span className="text-foreground text-lg font-semibold tabular-nums">
                        {formatEuroFromCents(invoice.amountCents)}
                      </span>
                      <span>Vervalt {formatDate(invoice.dueAt)}</span>
                      <span>{invoice.retryCount} pogingen geweest</span>
                    </div>
                    {invoice.checkoutUrl ? (
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        onPress={() =>
                          window.open(invoice.checkoutUrl, "_blank", "noopener,noreferrer")
                        }
                      >
                        Betaallink openen
                      </Button>
                    ) : null}
                  </Card.Content>
                </Card>
              ))}
            </div>
          </PageSection>
        ) : null}

        {activityFeed.length > 0 ? (
          <PageSection
            title="Recente activiteit"
            description="Laatste tien betaalevents uit Mollie en interne terugbetalingen."
          >
            <Card className="border-border/80 bg-surface rounded-2xl border shadow-none">
              <Card.Content className="divide-border/60 divide-y p-0">
                {activityFeed.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate font-medium">{entry.title}</p>
                      <p className="text-muted truncate text-sm">{entry.detail}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Chip
                        color={
                          entry.chipColor as "success" | "danger" | "warning" | "default"
                        }
                        size="sm"
                        variant="soft"
                      >
                        {entry.chipLabel}
                      </Chip>
                      <span className="text-muted text-xs tabular-nums">
                        {formatDate(entry.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </Card.Content>
            </Card>
          </PageSection>
        ) : null}

        <div id="revenue-setup" className="scroll-mt-28">
          <PageSection
            title="Omzetinstellingen"
            description="Leg vast hoe deze club verkoopt op de vloer en hoe medewerkers automatische incasso plannen."
            actions={
              <ActionCluster>
                <ActionButton
                  isDisabled={isPending}
                  variant="outline"
                  helpTitle="Omzet opslaan"
                  helpDescription="Slaat de afspraken voor webshop, balie en incasso op voor deze club. Dit verandert geen betalingen die vandaag al zijn gestart."
                  onPress={() =>
                    startTransition(async () => {
                      try {
                        await submitDashboardMutation("/api/platform/revenue-settings", {
                          webshopCollectionName,
                          pointOfSaleMode,
                          cardTerminalLabel,
                          autocollectPolicy,
                          directDebitLeadDays,
                        });
                        toast.success("Omzetinstellingen opgeslagen.");
                        router.refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Omzetinstellingen opslaan mislukt.",
                        );
                      }
                    })
                  }
                >
                  {isPending ? "Opslaan..." : "Omzet opslaan"}
                </ActionButton>
              </ActionCluster>
            }
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="min-w-0 rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
                <Card.Header className="items-start">
                  <div className="space-y-1">
                    <Card.Title>Verkoop op de vloer</Card.Title>
                    <Card.Description>
                      Alles wat medewerkers nodig hebben om webshop en balie eenduidig te gebruiken.
                    </Card.Description>
                  </div>
                </Card.Header>
                <Card.Content className="grid min-w-0 gap-4 md:grid-cols-2">
                  <div className="field-stack md:col-span-2">
                    <Label>Webshop collectie</Label>
                    <Input
                      fullWidth
                      value={webshopCollectionName}
                      onChange={(event) => setWebshopCollectionName(event.target.value)}
                    />
                  </div>
                  <div className="field-stack">
                    <label className="text-sm font-medium">Kassamodus</label>
                    <NativeSelect fullWidth>
                      <NativeSelect.Trigger
                        value={pointOfSaleMode}
                        onChange={(event) =>
                          setPointOfSaleMode(
                            event.target.value as typeof snapshot.revenueWorkspace.pointOfSaleMode,
                          )
                        }
                      >
                        {(["frontdesk", "kiosk", "hybrid"] as const).map((mode) => (
                          <NativeSelect.Option key={mode} value={mode}>
                            {getPointOfSaleModeLabel(mode)}
                          </NativeSelect.Option>
                        ))}
                        <NativeSelect.Indicator />
                      </NativeSelect.Trigger>
                    </NativeSelect>
                  </div>
                  <div className="field-stack">
                    <Label>Naam op de betaalterminal</Label>
                    <Input
                      fullWidth
                      value={cardTerminalLabel}
                      onChange={(event) => setCardTerminalLabel(event.target.value)}
                    />
                  </div>
                </Card.Content>
              </Card>

              <Card className="min-w-0 rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
                <Card.Header className="items-start">
                  <div className="space-y-1">
                    <Card.Title>Incasso-afspraken</Card.Title>
                    <Card.Description>
                      Leg vast hoe medewerkers maandelijkse incasso en opvolging plannen.
                    </Card.Description>
                  </div>
                </Card.Header>
                <Card.Content className="grid min-w-0 gap-4">
                  <div className="field-stack">
                    <Label>Incassobeleid</Label>
                    <Input
                      fullWidth
                      value={autocollectPolicy}
                      onChange={(event) => setAutocollectPolicy(event.target.value)}
                    />
                  </div>
                  <div className="field-stack max-w-56">
                    <Label>Voorbereiding incasso (dagen)</Label>
                    <Input
                      fullWidth
                      min={1}
                      type="number"
                      value={String(directDebitLeadDays)}
                      onChange={(event) =>
                        setDirectDebitLeadDays(Number(event.target.value || "0"))
                      }
                    />
                  </div>
                </Card.Content>
              </Card>
            </div>
          </PageSection>
        </div>

        <div id="collections-queue" className="scroll-mt-28">
          <PageSection
            title="Opvolging open betalingen"
            description="Houd intern bij welke betalingen nog nagebeld, hersteld of handmatig afgerond moeten worden."
            actions={
              <ActionCluster>
                <ActionButton
                  isDisabled={isPending}
                  variant="outline"
                  helpTitle="Betaalopvolging toevoegen"
                  helpDescription="Maakt een opvolgdossier aan voor medewerkers. Gebruik dit voor open posten die nog aandacht vragen, los van de live betaalstroom."
                  onPress={() =>
                    startTransition(async () => {
                      try {
                        await submitDashboardMutation("/api/platform/collection-cases", {
                          memberId: selectedCollectionMemberId || undefined,
                          memberName: collectionMemberName,
                          paymentMethod: collectionPaymentMethod,
                          status: collectionStatus,
                          amountCents: collectionAmountCents,
                          reason: collectionReason,
                          dueAt: collectionDueAt,
                          notes: collectionNotes || undefined,
                        });
                        setCollectionAmountInput(formatEuroFromCents(0));
                        setCollectionReason("");
                        setCollectionNotes("");
                        toast.success("Betaalopvolging toegevoegd.");
                        router.refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Betaalopvolging toevoegen mislukt.",
                        );
                      }
                    })
                  }
                >
                  {isPending ? "Opslaan..." : "Betaalopvolging toevoegen"}
                </ActionButton>
              </ActionCluster>
            }
          >
            <Card className="min-w-0 rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
              <Card.Header className="items-start">
                <div className="space-y-1">
                  <Card.Title>Nieuw opvolgdossier</Card.Title>
                  <Card.Description>
                    Leg vast om wie het gaat, welk bedrag nog openstaat en wat medewerkers moeten doen.
                  </Card.Description>
                </div>
              </Card.Header>
              <Card.Content className="grid min-w-0 max-w-full gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="field-stack">
                  <label className="text-sm font-medium">Lid</label>
                  <NativeSelect fullWidth>
                    <NativeSelect.Trigger
                      value={selectedCollectionMemberId}
                      onChange={(event) => {
                        setSelectedCollectionMemberId(event.target.value);
                        const member = snapshot.members.find(
                          (entry) => entry.id === event.target.value,
                        );
                        setCollectionMemberName(member?.fullName ?? "");
                      }}
                    >
                      {snapshot.members.map((member) => (
                        <NativeSelect.Option key={member.id} value={member.id}>
                          {member.fullName}
                        </NativeSelect.Option>
                      ))}
                      <NativeSelect.Indicator />
                    </NativeSelect.Trigger>
                  </NativeSelect>
                </div>
                <div className="field-stack">
                  <Label>Naam op het dossier</Label>
                  <Input
                    fullWidth
                    value={collectionMemberName}
                    onChange={(event) => setCollectionMemberName(event.target.value)}
                  />
                </div>
                <div className="field-stack">
                  <label className="text-sm font-medium">Betaalmethode</label>
                  <NativeSelect fullWidth>
                    <NativeSelect.Trigger
                      value={collectionPaymentMethod}
                      onChange={(event) =>
                        setCollectionPaymentMethod(
                          event.target.value as typeof collectionPaymentMethod,
                        )
                      }
                    >
                      {(
                        [
                          "direct_debit",
                          "payment_request",
                          "one_time",
                          "cash",
                          "bank_transfer",
                        ] as const
                      ).map((method) => (
                        <NativeSelect.Option key={method} value={method}>
                          {getBillingPaymentMethodLabel(method)}
                        </NativeSelect.Option>
                      ))}
                      <NativeSelect.Indicator />
                    </NativeSelect.Trigger>
                  </NativeSelect>
                </div>
                <div className="field-stack">
                  <label className="text-sm font-medium">Status</label>
                  <NativeSelect fullWidth>
                    <NativeSelect.Trigger
                      value={collectionStatus}
                      onChange={(event) =>
                        setCollectionStatus(event.target.value as typeof collectionStatus)
                      }
                    >
                      {(["open", "retrying", "resolved", "cancelled"] as const).map(
                        (status) => (
                          <NativeSelect.Option key={status} value={status}>
                            {getCollectionCaseStatusLabel(status)}
                          </NativeSelect.Option>
                        ),
                      )}
                      <NativeSelect.Indicator />
                    </NativeSelect.Trigger>
                  </NativeSelect>
                </div>
                <div className="field-stack">
                  <Label>Bedrag (€)</Label>
                  <Input
                    fullWidth
                    inputMode="decimal"
                    placeholder="€ 24,95"
                    type="text"
                    value={collectionAmountInput}
                    onBlur={() =>
                      setCollectionAmountInput(formatEuroFromCents(collectionAmountCents))
                    }
                    onChange={(event) => setCollectionAmountInput(event.target.value)}
                  />
                </div>
                <div className="field-stack">
                  <Label>Waarom staat dit nog open?</Label>
                  <Input
                    fullWidth
                    value={collectionReason}
                    onChange={(event) => setCollectionReason(event.target.value)}
                  />
                </div>
                <div className="field-stack">
                  <Label>Opvolgen voor</Label>
                  <Input
                    fullWidth
                    value={collectionDueAt}
                    onChange={(event) => setCollectionDueAt(event.target.value)}
                  />
                </div>
                <div className="field-stack">
                  <Label>Interne notities</Label>
                  <Input
                    fullWidth
                    value={collectionNotes}
                    onChange={(event) => setCollectionNotes(event.target.value)}
                  />
                </div>
              </Card.Content>
            </Card>

            <div className="grid gap-3">
              {snapshot.collectionCases.map((collectionCase) => (
                <Card
                  key={collectionCase.id}
                  className="min-w-0 rounded-2xl border-border/80 bg-surface-secondary"
                >
                  <Card.Content className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{collectionCase.memberName}</p>
                      <p className="text-muted text-sm">
                        {collectionCase.reason} · {formatEuroFromCents(collectionCase.amountCents)}
                      </p>
                      <p className="text-muted text-sm">
                        {getBillingPaymentMethodLabel(collectionCase.paymentMethod)} ·{" "}
                        {getCollectionCaseStatusLabel(collectionCase.status)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(["retrying", "resolved", "cancelled"] as const).map((nextStatus) => (
                        <Button
                          key={nextStatus}
                          size="sm"
                          variant="outline"
                          onPress={() =>
                            startTransition(async () => {
                              try {
                                await submitDashboardMutation(
                                  "/api/platform/collection-cases",
                                  {
                                    id: collectionCase.id,
                                    status: nextStatus,
                                  },
                                  { method: "PATCH" },
                                );
                                toast.success("Betaalopvolging bijgewerkt.");
                                router.refresh();
                              } catch (error) {
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "Betaalopvolging bijwerken mislukt.",
                                );
                              }
                            })
                          }
                        >
                          {getCollectionCaseStatusLabel(nextStatus)}
                        </Button>
                      ))}
                    </div>
                  </Card.Content>
                </Card>
              ))}
            </div>
          </PageSection>
        </div>

        <div id="mollie-account" className="scroll-mt-28">
          <PageSection
            title="Mollie instellen"
            description="Vier stappen om online betalingen via Mollie aan te zetten. Vink ze af zonder je zorgen te maken om de volgorde — de werkbank onderaan opent op de plek waar je nog actie moet doen."
          >
            <MollieSetupStepper snapshot={snapshot} />

            <LazyPlatformWorkbench
              sections={["payments"]}
              showLaunchHeader={false}
              snapshot={snapshot}
              stackSections
            />
          </PageSection>
        </div>

        <div id="billing-backoffice" className="scroll-mt-28">
          <PageSection
            title="Betalingsbeheer"
            description="Factuur klaarzetten, lopende betaalverzoeken, Ontvangsten en dagcontrole staan in één overzichtelijke werkplek."
          >
            <div className="grid min-w-0 gap-4">
              <Segment
                aria-label="Betalingsbeheer onderdelen"
                className="w-full max-w-4xl overflow-x-auto"
                selectedKey={billingWorkbenchTab}
                size="sm"
                onSelectionChange={(key) =>
                  setBillingWorkbenchTab(String(key) as BillingWorkbenchTab)
                }
              >
                {billingWorkbenchTabs.map((tab) => (
                  <Segment.Item key={tab.id} id={tab.id}>
                    {tab.label}
                  </Segment.Item>
                ))}
              </Segment>

              {billingWorkbenchTab === "invoice-draft" ? (
                <Card className="min-w-0 rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
                  <Card.Header className="items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Card.Title>Factuur klaarzetten</Card.Title>
                      <Card.Description>
                        Maak een nieuw betaalverzoek klaar voor een lid. Zodra Mollie live staat,
                        krijgt dit verzoek direct een betaalroute mee.
                      </Card.Description>
                    </div>
                    <ActionCluster>
                      <ActionButton
                        isDisabled={isPending}
                        variant="outline"
                        helpTitle="Factuur toevoegen"
                        helpDescription="Maakt een nieuw betaalverzoek aan voor dit lid. Gebruik dit voor losse betalingen, open lidmaatschappen of extra kosten."
                        onPress={() =>
                          startTransition(async () => {
                            try {
                              await submitDashboardMutation(
                                "/api/platform/billing-backoffice",
                                {
                                  operation: "create_invoice",
                                  memberId: invoiceMemberId || undefined,
                                  memberName: invoiceMemberName,
                                  description: invoiceDescription,
                                  amountCents: invoiceAmountCents,
                                  dueAt: invoiceDueAt,
                                  source: invoiceSource,
                                },
                              );
                              toast.success("Factuur toegevoegd.");
                              router.refresh();
                            } catch (error) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Factuur toevoegen mislukt.",
                              );
                            }
                          })
                        }
                      >
                        {isPending ? "Opslaan..." : "Factuur toevoegen"}
                      </ActionButton>
                    </ActionCluster>
                  </Card.Header>
                  <Card.Content className="grid min-w-0 max-w-full gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="field-stack">
                      <label className="text-sm font-medium">Lid</label>
                      <NativeSelect fullWidth>
                        <NativeSelect.Trigger
                          value={invoiceMemberId}
                          onChange={(event) => {
                            setInvoiceMemberId(event.target.value);
                            const member = snapshot.members.find(
                              (entry) => entry.id === event.target.value,
                            );
                            setInvoiceMemberName(member?.fullName ?? "");
                          }}
                        >
                          {snapshot.members.map((member) => (
                            <NativeSelect.Option key={member.id} value={member.id}>
                              {member.fullName}
                            </NativeSelect.Option>
                          ))}
                          <NativeSelect.Indicator />
                        </NativeSelect.Trigger>
                      </NativeSelect>
                    </div>
                    <div className="field-stack">
                      <Label>Beschrijving</Label>
                      <Input
                        fullWidth
                        value={invoiceDescription}
                        onChange={(event) => setInvoiceDescription(event.target.value)}
                      />
                    </div>
                    <div className="field-stack">
                      <Label>Bedrag (€)</Label>
                      <Input
                        fullWidth
                        inputMode="decimal"
                        placeholder="€ 119,00"
                        type="text"
                        value={invoiceAmountInput}
                        onBlur={() =>
                          setInvoiceAmountInput(formatEuroFromCents(invoiceAmountCents))
                        }
                        onChange={(event) => setInvoiceAmountInput(event.target.value)}
                      />
                    </div>
                    <div className="field-stack">
                      <Label>Vervalt op</Label>
                      <Input
                        fullWidth
                        value={invoiceDueAt}
                        onChange={(event) => setInvoiceDueAt(event.target.value)}
                      />
                    </div>
                    <div className="field-stack">
                      <label className="text-sm font-medium">Bron</label>
                      <NativeSelect fullWidth>
                        <NativeSelect.Trigger
                          value={invoiceSource}
                          onChange={(event) =>
                            setInvoiceSource(event.target.value as typeof invoiceSource)
                          }
                        >
                          {(
                            [
                              "membership",
                              "signup_checkout",
                              "appointment_pack",
                              "late_fee",
                              "manual",
                            ] as const
                          ).map((source) => (
                            <NativeSelect.Option key={source} value={source}>
                              {getBillingInvoiceSourceLabel(source)}
                            </NativeSelect.Option>
                          ))}
                          <NativeSelect.Indicator />
                        </NativeSelect.Trigger>
                      </NativeSelect>
                    </div>
                  </Card.Content>
                </Card>
              ) : null}

              {billingWorkbenchTab === "payment-requests" ? (
                <Card className="min-w-0 rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
                  <Card.Header className="items-start">
                    <div className="space-y-1">
                      <Card.Title>Lopende betaalverzoeken</Card.Title>
                      <Card.Description>
                        Bekijk open betalingen, open de betaallink opnieuw of leg een
                        terugbetaling vast vanuit dezelfde lijst.
                      </Card.Description>
                    </div>
                  </Card.Header>
                  <Card.Content className="grid gap-4">
                    <div className="grid min-w-0 max-w-full gap-4 md:grid-cols-2">
                      <div className="field-stack">
                        <Label>Terug te betalen bedrag</Label>
                        <Input
                          fullWidth
                          inputMode="decimal"
                          placeholder="€ 24,95"
                          type="text"
                          value={refundAmountInput}
                          onBlur={() =>
                            setRefundAmountInput(formatEuroFromCents(refundAmountCents))
                          }
                          onChange={(event) => setRefundAmountInput(event.target.value)}
                        />
                      </div>
                      <div className="field-stack">
                        <Label>Reden terugbetaling</Label>
                        <Input
                          fullWidth
                          value={refundReason}
                          onChange={(event) => setRefundReason(event.target.value)}
                        />
                      </div>
                    </div>

                    {paymentRequestRows.length > 0 ? (
                      <DataGrid
                        allowsColumnResize
                        aria-label="Lopende betaalverzoeken"
                        className="rounded-2xl"
                        columns={paymentRequestColumns}
                        contentClassName="min-w-[1120px]"
                        data={paymentRequestRows}
                        defaultSortDescriptor={{ column: "dueAt", direction: "ascending" }}
                        getRowId={(invoice) => invoice.id}
                        scrollContainerClassName="max-w-full overflow-x-auto"
                        variant="primary"
                      />
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/80 bg-surface px-4 py-8 text-center">
                        <p className="font-medium">Geen lopende betaalverzoeken</p>
                        <p className="text-muted mt-1 text-sm">
                          Nieuwe facturen en open betaalverzoeken verschijnen hier zodra ze zijn
                          aangemaakt.
                        </p>
                      </div>
                    )}
                  </Card.Content>
                </Card>
              ) : null}

              {billingWorkbenchTab === "receipts" ? (
                <Card className="min-w-0 rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
                  <Card.Header className="items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Card.Title>Ontvangsten</Card.Title>
                        <Chip size="sm" variant="tertiary">
                          Alleen bij afwijkingen
                        </Chip>
                      </div>
                      <Card.Description>
                        Werk een ontvangen betaling bij wanneer je geld hebt teruggevonden en de
                        administratie direct gelijk wilt zetten.
                      </Card.Description>
                    </div>
                  </Card.Header>
                  <Card.Content className="grid min-w-0 max-w-full gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="field-stack">
                      <label className="text-sm font-medium">Factuur</label>
                      <NativeSelect fullWidth>
                        <NativeSelect.Trigger
                          value={selectedInvoiceId}
                          onChange={(event) => setSelectedInvoiceId(event.target.value)}
                        >
                          {snapshot.billingBackoffice.invoices.map((invoice) => (
                            <NativeSelect.Option key={invoice.id} value={invoice.id}>
                              {invoice.memberName} ·{" "}
                              {getBillingInvoiceStatusLabel(invoice.status)}
                            </NativeSelect.Option>
                          ))}
                          <NativeSelect.Indicator />
                        </NativeSelect.Trigger>
                      </NativeSelect>
                    </div>
                    <div className="field-stack">
                      <Label>Betaaluitkomst</Label>
                      <Input
                        fullWidth
                        value={paymentOutcome}
                        onChange={(event) => setPaymentOutcome(event.target.value)}
                      />
                    </div>
                    <div className="field-stack">
                      <Label>Betalingskenmerk</Label>
                      <Input
                        fullWidth
                        value={providerReference}
                        onChange={(event) => setProviderReference(event.target.value)}
                      />
                    </div>
                    <div className="field-stack">
                      <Label>Wat is er gebeurd?</Label>
                      <Input
                        fullWidth
                        value={payloadSummary}
                        onChange={(event) => setPayloadSummary(event.target.value)}
                      />
                    </div>
                    <div className="field-stack">
                      <Label>Afhandelstatus</Label>
                      <NativeSelect fullWidth>
                        <NativeSelect.Trigger
                          value={paymentUpdateStatus}
                          onChange={(event) =>
                            setPaymentUpdateStatus(
                              event.target.value as typeof paymentUpdateStatus,
                            )
                          }
                        >
                          {(["received", "processed", "failed"] as const).map(
                            (nextStatus) => (
                              <NativeSelect.Option key={nextStatus} value={nextStatus}>
                                {getBillingWebhookStatusLabel(nextStatus)}
                              </NativeSelect.Option>
                            ),
                          )}
                          <NativeSelect.Indicator />
                        </NativeSelect.Trigger>
                      </NativeSelect>
                    </div>
                  </Card.Content>
                  <Card.Content className="pt-0">
                    <div className="flex max-w-full flex-col gap-2">
                      <ActionCluster>
                        <ActionButton
                          isDisabled={Boolean(paymentUpdateDisabledReason)}
                          variant="outline"
                          helpTitle="Ontvangst bijwerken"
                          helpDescription="Werk de stand van een betaling bij wanneer je geld hebt teruggevonden en de administratie meteen gelijk wilt zetten."
                          onPress={() =>
                            startTransition(async () => {
                              try {
                                await submitDashboardMutation(
                                  "/api/platform/billing-backoffice",
                                  {
                                    operation: "record_webhook",
                                    invoiceId: selectedInvoiceId,
                                    eventType: paymentOutcome,
                                    status: paymentUpdateStatus,
                                    providerReference,
                                    payloadSummary,
                                  },
                                );
                                toast.success("Ontvangst bijgewerkt.");
                                router.refresh();
                              } catch (error) {
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "Ontvangst bijwerken mislukt.",
                                );
                              }
                            })
                          }
                        >
                          Ontvangst bijwerken
                        </ActionButton>
                      </ActionCluster>
                      <DisabledActionReason reason={paymentUpdateDisabledReason} />
                    </div>
                  </Card.Content>
                </Card>
              ) : null}

              {billingWorkbenchTab === "daily-control" ? (
                <Card className="min-w-0 rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
                  <Card.Header className="items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Card.Title>Dagcontrole</Card.Title>
                        <Chip size="sm" variant="tertiary">
                          Alleen bij afwijkingen
                        </Chip>
                      </div>
                      <Card.Description>
                        Leg aan het einde van de dag vast welke posten kloppen en welke nog
                        aandacht nodig hebben.
                      </Card.Description>
                    </div>
                  </Card.Header>
                  <Card.Content className="grid min-w-0 max-w-full gap-4 md:grid-cols-2">
                    <div className="field-stack md:col-span-2">
                      <Label>Notitie dagcontrole</Label>
                      <Input
                        fullWidth
                        value={dailyControlNote}
                        onChange={(event) => setDailyControlNote(event.target.value)}
                      />
                    </div>
                  </Card.Content>
                  <Card.Content className="pt-0">
                    <ActionCluster>
                      <ActionButton
                        isDisabled={isPending}
                        variant="ghost"
                        helpTitle="Dagcontrole opslaan"
                        helpDescription="Leg vast welke betalingen al kloppen en welke nog aandacht nodig hebben. Dit helpt medewerkers de dag netjes af te ronden."
                        onPress={() =>
                          startTransition(async () => {
                            try {
                              await submitDashboardMutation(
                                "/api/platform/billing-backoffice",
                                {
                                  operation: "reconcile",
                                  note: dailyControlNote,
                                },
                              );
                              toast.success("Dagcontrole opgeslagen.");
                              router.refresh();
                            } catch (error) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Dagcontrole opslaan mislukt.",
                              );
                            }
                          })
                        }
                      >
                        Dagcontrole opslaan
                      </ActionButton>
                    </ActionCluster>
                  </Card.Content>
                </Card>
              ) : null}
            </div>
          </PageSection>
        </div>

        <div id="payment-modules" className="scroll-mt-28">
          <PageSection
            title="Betaalmodules"
            description="Compact overzicht van betaalverwerking, incasso en betaalopvolging."
          >
            <FeatureModuleBoard
              currentPage="payments"
              features={paymentFeatures}
              snapshot={snapshot}
            />
          </PageSection>
        </div>
    </div>
  );
}
