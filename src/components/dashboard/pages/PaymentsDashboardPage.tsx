"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { Card, Chip, Input, Label } from "@heroui/react";
import { Button } from "@/components/dashboard/HydrationSafeButton";
import { NativeSelect } from "@/components/dashboard/HydrationSafeNativeSelect";
import { toast } from "sonner";
import { submitDashboardMutation } from "@/components/dashboard/dashboard-client-helpers";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import { LazyPlatformWorkbench } from "@/components/dashboard/LazyPlatformWorkbench";
import {
  DisabledActionReason,
  PageSection,
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

function formatMissingFields(fields: ReadonlyArray<string>) {
  if (fields.length === 0) {
    return "";
  }

  if (fields.length === 1) {
    return fields[0]!;
  }

  return `${fields.slice(0, -1).join(", ")} en ${fields.at(-1)}`;
}

export function PaymentsDashboardPage({ snapshot }: DashboardPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const paymentFeatures = snapshot.featureFlags.filter(
    (feature) => feature.dashboardPage === "payments",
  );
  const [webshopCollectionName, setWebshopCollectionName] = useState(
    snapshot.revenueWorkspace.webshopCollectionName,
  );
  const [pointOfSaleMode, setPointOfSaleMode] = useState(snapshot.revenueWorkspace.pointOfSaleMode);
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
  const [invoiceMemberName, setInvoiceMemberName] = useState(snapshot.members[0]?.fullName ?? "");
  const [invoiceDescription, setInvoiceDescription] = useState("Lidmaatschap factuur");
  const [invoiceAmountInput, setInvoiceAmountInput] = useState(formatEuroFromCents(0));
  const [invoiceDueAt, setInvoiceDueAt] = useState("2026-05-01T08:00:00.000Z");
  const [invoiceSource, setInvoiceSource] = useState<
    "membership" | "signup_checkout" | "appointment_pack" | "late_fee" | "manual"
  >("membership");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(
    snapshot.billingBackoffice.invoices[0]?.id ?? "",
  );
  const [webhookEventType, setWebhookEventType] = useState("betaling.betaald");
  const [webhookStatus, setWebhookStatus] = useState<"received" | "processed" | "failed">("processed");
  const [providerReference, setProviderReference] = useState("betaling-123");
  const [payloadSummary, setPayloadSummary] = useState("Betaalupdate verwerkt");
  const [terugbetalingAmountInput, setTerugbetalingAmountInput] = useState(
    formatEuroFromCents(0),
  );
  const [terugbetalingReason, setTerugbetalingReason] = useState("Terugbetaling");
  const [dagafsluitingNote, setDagafsluitingNote] = useState("Dagelijkse uitbetalingscontrole");
  const collectionAmountCents = parseEuroInputToCents(collectionAmountInput);
  const invoiceAmountCents = parseEuroInputToCents(invoiceAmountInput);
  const terugbetalingAmountCents = parseEuroInputToCents(terugbetalingAmountInput);

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

  const missingWebhookRegistrationFields = [
    selectedInvoiceId ? null : "factuur",
    webhookEventType.trim() ? null : "type betaalupdate",
    providerReference.trim() ? null : "betaalreferentie",
    payloadSummary.trim() ? null : "samenvatting",
    snapshot.payments.webhookUrlConfigured ? null : "webhook-url",
  ].filter((field): field is string => Boolean(field));
  const webhookRegistrationDisabledReason = isPending
    ? "Even wachten: er loopt al een betaalactie."
    : missingWebhookRegistrationFields.length > 0
      ? `Webhook registreren kan nog niet: vul ${formatMissingFields(missingWebhookRegistrationFields)} in.`
      : null;

  return (
    <div className="section-stack min-w-0 max-w-full overflow-x-clip">
      <PageSection
        title="Omzetinstellingen"
        description="Stel webshop, balieverkoop en automatische incasso in zodat betalingen op de vloer kloppen."
        actions={
          <Button
            isDisabled={isPending}
            variant="outline"
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
                    error instanceof Error ? error.message : "Omzetinstellingen opslaan mislukt.",
                  );
                }
              })
            }
          >
            {isPending ? "Opslaan..." : "Omzet opslaan"}
          </Button>
        }
      >
        <Card className="min-w-0 max-w-full rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
          <Card.Content className="grid min-w-0 max-w-full gap-4 md:grid-cols-2">
            <div className="field-stack">
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
              <Label>Betaalterminal</Label>
              <Input
                fullWidth
                value={cardTerminalLabel}
                onChange={(event) => setCardTerminalLabel(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Incassobeleid</Label>
              <Input
                fullWidth
                value={autocollectPolicy}
                onChange={(event) => setAutocollectPolicy(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Voorbereiding incasso (dagen)</Label>
              <Input
                fullWidth
                min={1}
                type="number"
                value={String(directDebitLeadDays)}
                onChange={(event) => setDirectDebitLeadDays(Number(event.target.value || "0"))}
              />
            </div>
          </Card.Content>
        </Card>
      </PageSection>

      <PageSection
        title="Opvolging open betalingen"
        description="Volg mislukte incasso’s, toeslagen en betaalverzoeken op zonder externe spreadsheet."
        actions={
          <Button
            isDisabled={isPending}
            variant="outline"
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
                    error instanceof Error ? error.message : "Betaalopvolging toevoegen mislukt.",
                  );
                }
              })
            }
          >
            {isPending ? "Opslaan..." : "Betaalopvolging toevoegen"}
          </Button>
        }
      >
        <Card className="min-w-0 max-w-full rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
          <Card.Content className="grid min-w-0 max-w-full gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="field-stack">
              <label className="text-sm font-medium">Lid</label>
              <NativeSelect fullWidth>
                <NativeSelect.Trigger
                  value={selectedCollectionMemberId}
                  onChange={(event) => {
                    setSelectedCollectionMemberId(event.target.value);
                    const member = snapshot.members.find((entry) => entry.id === event.target.value);
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
              <Label>Lidnaam</Label>
              <Input fullWidth value={collectionMemberName} onChange={(event) => setCollectionMemberName(event.target.value)} />
            </div>
            <div className="field-stack">
              <label className="text-sm font-medium">Betaalmethode</label>
              <NativeSelect fullWidth>
                <NativeSelect.Trigger
                  value={collectionPaymentMethod}
                  onChange={(event) =>
                    setCollectionPaymentMethod(event.target.value as typeof collectionPaymentMethod)
                  }
                >
                  {(["direct_debit", "payment_request", "one_time", "cash", "bank_transfer"] as const).map((method) => (
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
                  {(["open", "retrying", "resolved", "cancelled"] as const).map((status) => (
                    <NativeSelect.Option key={status} value={status}>
                      {getCollectionCaseStatusLabel(status)}
                    </NativeSelect.Option>
                  ))}
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
                onBlur={() => setCollectionAmountInput(formatEuroFromCents(collectionAmountCents))}
                onChange={(event) => setCollectionAmountInput(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Reden</Label>
              <Input fullWidth value={collectionReason} onChange={(event) => setCollectionReason(event.target.value)} />
            </div>
            <div className="field-stack">
              <Label>Vervaldatum</Label>
              <Input fullWidth value={collectionDueAt} onChange={(event) => setCollectionDueAt(event.target.value)} />
            </div>
            <div className="field-stack">
              <Label>Notities</Label>
              <Input fullWidth value={collectionNotes} onChange={(event) => setCollectionNotes(event.target.value)} />
            </div>
          </Card.Content>
        </Card>
        <div className="grid gap-3">
          {snapshot.collectionCases.map((collectionCase) => (
            <Card key={collectionCase.id} className="min-w-0 max-w-full rounded-2xl border-border/80 bg-surface-secondary">
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

      <PageSection
        title="Betalingsbeheer"
        description="Werk facturen, mislukte betalingen en terugbetalingen af zonder externe tooling."
      >
        <Card className="min-w-0 max-w-full rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
          <Card.Content className="grid min-w-0 max-w-full gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="field-stack">
              <label className="text-sm font-medium">Lid</label>
              <NativeSelect fullWidth>
                <NativeSelect.Trigger
                  value={invoiceMemberId}
                  onChange={(event) => {
                    setInvoiceMemberId(event.target.value);
                    const member = snapshot.members.find((entry) => entry.id === event.target.value);
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
              <Input fullWidth value={invoiceDescription} onChange={(event) => setInvoiceDescription(event.target.value)} />
            </div>
            <div className="field-stack">
              <Label>Bedrag (€)</Label>
              <Input
                fullWidth
                inputMode="decimal"
                placeholder="€ 119,00"
                type="text"
                value={invoiceAmountInput}
                onBlur={() => setInvoiceAmountInput(formatEuroFromCents(invoiceAmountCents))}
                onChange={(event) => setInvoiceAmountInput(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Vervalt op</Label>
              <Input fullWidth value={invoiceDueAt} onChange={(event) => setInvoiceDueAt(event.target.value)} />
            </div>
            <div className="field-stack">
              <label className="text-sm font-medium">Bron</label>
              <NativeSelect fullWidth>
                <NativeSelect.Trigger value={invoiceSource} onChange={(event) => setInvoiceSource(event.target.value as typeof invoiceSource)}>
                  {(["membership", "signup_checkout", "appointment_pack", "late_fee", "manual"] as const).map((source) => (
                    <NativeSelect.Option key={source} value={source}>
                      {getBillingInvoiceSourceLabel(source)}
                    </NativeSelect.Option>
                  ))}
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
            </div>
            <div className="field-stack justify-end">
              <Button
                isDisabled={isPending}
                variant="outline"
                onPress={() =>
                  startTransition(async () => {
                    try {
                      await submitDashboardMutation("/api/platform/billing-backoffice", {
                        operation: "create_invoice",
                        memberId: invoiceMemberId || undefined,
                        memberName: invoiceMemberName,
                        description: invoiceDescription,
                        amountCents: invoiceAmountCents,
                        dueAt: invoiceDueAt,
                        source: invoiceSource,
                      });
                      toast.success("Factuur toegevoegd.");
                      router.refresh();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Factuur toevoegen mislukt.");
                    }
                  })
                }
              >
                Factuur toevoegen
              </Button>
            </div>
          </Card.Content>
        </Card>

        <div className="grid gap-3">
          {snapshot.billingBackoffice.invoices.map((invoice) => (
            <Card key={invoice.id} className="min-w-0 max-w-full rounded-2xl border-border/80 bg-surface-secondary">
              <Card.Content className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{invoice.memberName}</p>
                    <p className="text-muted text-sm">
                      {invoice.description} · {formatEuroFromCents(invoice.amountCents)} ·{" "}
                      {getBillingInvoiceStatusLabel(invoice.status)}
                    </p>
                  </div>
                  <Chip size="sm" variant="soft">
                    pogingen: {invoice.retryCount}
                  </Chip>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
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
                          toast.error(error instanceof Error ? error.message : "Nieuwe betaalpoging mislukt.");
                        }
                      })
                    }
                  >
                    Opnieuw proberen
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() =>
                      startTransition(async () => {
                        try {
                          await submitDashboardMutation("/api/platform/billing-backoffice", {
                            operation: "refund_invoice",
                            invoiceId: invoice.id,
                            amountCents: terugbetalingAmountCents || invoice.amountCents,
                            reason: terugbetalingReason,
                          });
                          toast.success("Terugbetaling vastgelegd.");
                          router.refresh();
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Terugbetaling mislukt.");
                        }
                      })
                    }
                  >
                    Terugbetalen
                  </Button>
                </div>
              </Card.Content>
            </Card>
          ))}
        </div>

        <details className="min-w-0 max-w-full rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
          <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-4 px-5 py-4 marker:hidden">
            <div className="min-w-0 space-y-1">
              <p className="font-medium">Geavanceerde betaalcontrole</p>
              <p className="text-muted text-sm leading-6">
                Alleen gebruiken met support voor betaalupdates, referenties en dagafsluiting.
              </p>
            </div>
            <Chip size="sm" variant="tertiary">
              Geavanceerd
            </Chip>
          </summary>
          <Card className="mx-4 mb-4 min-w-0 max-w-full rounded-[24px] border border-border/70 bg-surface shadow-none">
            <Card.Content className="grid min-w-0 max-w-full gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="field-stack">
                <label className="text-sm font-medium">Factuur</label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger value={selectedInvoiceId} onChange={(event) => setSelectedInvoiceId(event.target.value)}>
                    {snapshot.billingBackoffice.invoices.map((invoice) => (
                      <NativeSelect.Option key={invoice.id} value={invoice.id}>
                        {invoice.memberName} · {getBillingInvoiceStatusLabel(invoice.status)}
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <div className="field-stack">
                <Label>Type betaalupdate</Label>
                <Input fullWidth value={webhookEventType} onChange={(event) => setWebhookEventType(event.target.value)} />
              </div>
              <div className="field-stack">
                <Label>Betaalreferentie</Label>
                <Input fullWidth value={providerReference} onChange={(event) => setProviderReference(event.target.value)} />
              </div>
              <div className="field-stack">
                <Label>Samenvatting</Label>
                <Input fullWidth value={payloadSummary} onChange={(event) => setPayloadSummary(event.target.value)} />
              </div>
              <div className="field-stack">
                <Label>Verwerkingsstatus</Label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger value={webhookStatus} onChange={(event) => setWebhookStatus(event.target.value as typeof webhookStatus)}>
                    {(["received", "processed", "failed"] as const).map((nextStatus) => (
                      <NativeSelect.Option key={nextStatus} value={nextStatus}>
                        {getBillingWebhookStatusLabel(nextStatus)}
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <div className="field-stack">
                <Label>Terug te betalen bedrag</Label>
                <Input
                  fullWidth
                  inputMode="decimal"
                  placeholder="€ 24,95"
                  type="text"
                  value={terugbetalingAmountInput}
                  onBlur={() =>
                    setTerugbetalingAmountInput(formatEuroFromCents(terugbetalingAmountCents))
                  }
                  onChange={(event) => setTerugbetalingAmountInput(event.target.value)}
                />
              </div>
              <div className="field-stack">
                <Label>Reden terugbetaling</Label>
                <Input fullWidth value={terugbetalingReason} onChange={(event) => setTerugbetalingReason(event.target.value)} />
              </div>
              <div className="field-stack">
                <Label>Notitie dagafsluiting</Label>
                <Input fullWidth value={dagafsluitingNote} onChange={(event) => setDagafsluitingNote(event.target.value)} />
              </div>
            </Card.Content>
            <Card.Content className="flex flex-wrap gap-3 pt-0">
              <div className="flex max-w-full flex-col gap-2">
                <Button
                  isDisabled={Boolean(webhookRegistrationDisabledReason)}
                  variant="outline"
                  onPress={() =>
                    startTransition(async () => {
                      try {
                        await submitDashboardMutation("/api/platform/billing-backoffice", {
                          operation: "record_webhook",
                          invoiceId: selectedInvoiceId,
                          eventType: webhookEventType,
                          status: webhookStatus,
                          providerReference,
                          payloadSummary,
                        });
                        toast.success("Webhook geregistreerd.");
                        router.refresh();
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Webhook registreren mislukt.");
                      }
                    })
                  }
                >
                  Webhook registreren
                </Button>
                <DisabledActionReason reason={webhookRegistrationDisabledReason} />
              </div>
              <Button
                isDisabled={isPending}
                variant="ghost"
                onPress={() =>
                  startTransition(async () => {
                    try {
                      await submitDashboardMutation("/api/platform/billing-backoffice", {
                        operation: "reconcile",
                        note: dagafsluitingNote,
                      });
                      toast.success("Dagafsluiting gecontroleerd.");
                      router.refresh();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Dagafsluiting controleren mislukt.");
                    }
                  })
                }
              >
                Dagafsluiting controleren
              </Button>
            </Card.Content>
          </Card>
        </details>
      </PageSection>

      <PageSection
        title="Betalingen"
        description="Betaalprofiel, actieve betaalroutes en uitbetalingsstatus."
      >
        <div className="grid gap-4">
          <Card className="min-w-0 max-w-full rounded-2xl border-border/80 bg-surface-secondary">
            <Card.Content className="space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <p className="font-medium">{snapshot.payments.profileLabel}</p>
              </div>
              <p className="text-muted text-sm">{snapshot.payments.helpText}</p>
              <div className="flex flex-wrap gap-2">
                <Chip size="sm" variant="soft">
                  {snapshot.payments.statusLabel}
                </Chip>
                {snapshot.payments.paymentMethods.map((method) => (
                  <Chip key={method} size="sm" variant="tertiary">
                    {getBillingPaymentMethodLabel(method)}
                  </Chip>
                ))}
              </div>
            </Card.Content>
          </Card>

          <Card className="min-w-0 max-w-full rounded-2xl border-border/80 bg-surface-secondary">
            <Card.Content className="space-y-2">
              <p className="text-muted text-sm">Betaalsupport</p>
              <p className="break-all font-medium">{snapshot.payments.supportEmail}</p>
              <p className="text-muted text-sm">Uitbetaling: {snapshot.payments.settlementLabel}</p>
            </Card.Content>
          </Card>
        </div>
      </PageSection>

      <LazyPlatformWorkbench
        sections={["payments"]}
        showLaunchHeader={false}
        snapshot={snapshot}
        stackSections
      />

      <PageSection
        title="Betaalmodules"
        description="Compact overzicht van betaalverwerking, incasso en betaalopvolging."
      >
        <FeatureModuleBoard currentPage="payments" features={paymentFeatures} snapshot={snapshot} />
      </PageSection>
    </div>
  );
}
