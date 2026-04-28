"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { Button, Card, Chip, Input, Label } from "@heroui/react";
import { NativeSelect } from "@heroui-pro/react/native-select";
import { toast } from "sonner";
import { submitDashboardMutation } from "@/components/dashboard/dashboard-client-helpers";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import { LazyPlatformWorkbench } from "@/components/dashboard/LazyPlatformWorkbench";
import { PageSection, type DashboardPageProps } from "@/components/dashboard/shared";

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
  const [collectionAmountCents, setCollectionAmountCents] = useState(0);
  const [collectionReason, setCollectionReason] = useState("");
  const [collectionDueAt, setCollectionDueAt] = useState("2026-05-01T09:00:00.000Z");
  const [collectionNotes, setCollectionNotes] = useState("");
  const [invoiceMemberId, setInvoiceMemberId] = useState(snapshot.members[0]?.id ?? "");
  const [invoiceMemberName, setInvoiceMemberName] = useState(snapshot.members[0]?.fullName ?? "");
  const [invoiceDescription, setInvoiceDescription] = useState("Membership factuur");
  const [invoiceAmountCents, setInvoiceAmountCents] = useState(0);
  const [invoiceDueAt, setInvoiceDueAt] = useState("2026-05-01T08:00:00.000Z");
  const [invoiceSource, setInvoiceSource] = useState<
    "membership" | "signup_checkout" | "appointment_pack" | "late_fee" | "manual"
  >("membership");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(
    snapshot.billingBackoffice.invoices[0]?.id ?? "",
  );
  const [webhookEventType, setWebhookEventType] = useState("payment.paid");
  const [webhookStatus, setWebhookStatus] = useState<"received" | "processed" | "failed">("processed");
  const [providerReference, setProviderReference] = useState("tr_mollie");
  const [payloadSummary, setPayloadSummary] = useState("Webhook verwerkt");
  const [refundAmountCents, setRefundAmountCents] = useState(0);
  const [refundReason, setRefundReason] = useState("Refund");
  const [reconcileNote, setReconcileNote] = useState("Daily settlement sync");

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

  return (
    <div className="section-stack">
      <PageSection
        title="Billing modules"
        description="Betaalverwerking, incasso en AutoCollect zijn tenant-level uitbreidingen bovenop je kernbilling."
      >
        <FeatureModuleBoard features={paymentFeatures} snapshot={snapshot} />
      </PageSection>

      <PageSection
        title="Revenue setup"
        description="Maak webshop, PoS en AutoCollect concreet zodat je betaalstack ook operationeel klopt op de vloer."
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
        <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
          <Card.Content className="grid gap-4 md:grid-cols-2">
            <div className="field-stack">
              <Label>Webshop collectie</Label>
              <Input
                fullWidth
                value={webshopCollectionName}
                onChange={(event) => setWebshopCollectionName(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <label className="text-sm font-medium">Point of sale modus</label>
              <NativeSelect fullWidth>
                <NativeSelect.Trigger
                  value={pointOfSaleMode}
                  onChange={(event) =>
                    setPointOfSaleMode(
                      event.target.value as typeof snapshot.revenueWorkspace.pointOfSaleMode,
                    )
                  }
                >
                  <NativeSelect.Option value="frontdesk">Frontdesk</NativeSelect.Option>
                  <NativeSelect.Option value="kiosk">Kiosk</NativeSelect.Option>
                  <NativeSelect.Option value="hybrid">Hybrid</NativeSelect.Option>
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
            </div>
            <div className="field-stack">
              <Label>Card terminal label</Label>
              <Input
                fullWidth
                value={cardTerminalLabel}
                onChange={(event) => setCardTerminalLabel(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>AutoCollect policy</Label>
              <Input
                fullWidth
                value={autocollectPolicy}
                onChange={(event) => setAutocollectPolicy(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>SEPA lead days</Label>
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
        title="Collections queue"
        description="Volg mislukte incasso’s, late fees en betaalverzoeken op zonder externe spreadsheet."
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
                  setCollectionAmountCents(0);
                  setCollectionReason("");
                  setCollectionNotes("");
                  toast.success("Collection case toegevoegd.");
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Collection case toevoegen mislukt.",
                  );
                }
              })
            }
          >
            {isPending ? "Opslaan..." : "Collection case toevoegen"}
          </Button>
        }
      >
        <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
          <Card.Content className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              <Label>Member naam</Label>
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
                  <NativeSelect.Option value="direct_debit">Direct debit</NativeSelect.Option>
                  <NativeSelect.Option value="payment_request">Payment request</NativeSelect.Option>
                  <NativeSelect.Option value="one_time">One-time</NativeSelect.Option>
                  <NativeSelect.Option value="cash">Cash</NativeSelect.Option>
                  <NativeSelect.Option value="bank_transfer">Bank transfer</NativeSelect.Option>
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
                  <NativeSelect.Option value="open">Open</NativeSelect.Option>
                  <NativeSelect.Option value="retrying">Retrying</NativeSelect.Option>
                  <NativeSelect.Option value="resolved">Resolved</NativeSelect.Option>
                  <NativeSelect.Option value="cancelled">Cancelled</NativeSelect.Option>
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
            </div>
            <div className="field-stack">
              <Label>Bedrag (cent)</Label>
              <Input
                fullWidth
                min={0}
                type="number"
                value={String(collectionAmountCents)}
                onChange={(event) => setCollectionAmountCents(Number(event.target.value || "0"))}
              />
            </div>
            <div className="field-stack">
              <Label>Reden</Label>
              <Input fullWidth value={collectionReason} onChange={(event) => setCollectionReason(event.target.value)} />
            </div>
            <div className="field-stack">
              <Label>Due date</Label>
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
            <Card key={collectionCase.id} className="rounded-2xl border-border/80 bg-surface-secondary">
              <Card.Content className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium">{collectionCase.memberName}</p>
                  <p className="text-muted text-sm">
                    {collectionCase.reason} · {collectionCase.amountCents} cent
                  </p>
                  <p className="text-muted text-sm">
                    {collectionCase.paymentMethod} · {collectionCase.status}
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
                            toast.success("Collection case bijgewerkt.");
                            router.refresh();
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "Collection case bijwerken mislukt.",
                            );
                          }
                        })
                      }
                    >
                      {nextStatus}
                    </Button>
                  ))}
                </div>
              </Card.Content>
            </Card>
          ))}
        </div>
      </PageSection>

      <PageSection
        title="Billing backoffice"
        description="Werk facturen, retries, refunds, webhooks en reconciliatie af zonder externe tooling."
      >
        <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
          <Card.Content className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
              <Label>Bedrag (cent)</Label>
              <Input fullWidth type="number" value={String(invoiceAmountCents)} onChange={(event) => setInvoiceAmountCents(Number(event.target.value || "0"))} />
            </div>
            <div className="field-stack">
              <Label>Vervalt op</Label>
              <Input fullWidth value={invoiceDueAt} onChange={(event) => setInvoiceDueAt(event.target.value)} />
            </div>
            <div className="field-stack">
              <label className="text-sm font-medium">Bron</label>
              <NativeSelect fullWidth>
                <NativeSelect.Trigger value={invoiceSource} onChange={(event) => setInvoiceSource(event.target.value as typeof invoiceSource)}>
                  <NativeSelect.Option value="membership">Membership</NativeSelect.Option>
                  <NativeSelect.Option value="signup_checkout">Signup checkout</NativeSelect.Option>
                  <NativeSelect.Option value="appointment_pack">Appointment pack</NativeSelect.Option>
                  <NativeSelect.Option value="late_fee">Late fee</NativeSelect.Option>
                  <NativeSelect.Option value="manual">Manual</NativeSelect.Option>
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
            <Card key={invoice.id} className="rounded-2xl border-border/80 bg-surface-secondary">
              <Card.Content className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{invoice.memberName}</p>
                    <p className="text-muted text-sm">
                      {invoice.description} · {invoice.amountCents} cent · {invoice.status}
                    </p>
                  </div>
                  <Chip size="sm" variant="soft">
                    retry {invoice.retryCount}
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
                            reason: "Owner retry",
                          });
                          toast.success("Retry ingepland.");
                          router.refresh();
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Retry mislukt.");
                        }
                      })
                    }
                  >
                    Retry
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
                            amountCents: refundAmountCents || invoice.amountCents,
                            reason: refundReason,
                          });
                          toast.success("Refund vastgelegd.");
                          router.refresh();
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Refund mislukt.");
                        }
                      })
                    }
                  >
                    Refund
                  </Button>
                </div>
              </Card.Content>
            </Card>
          ))}
        </div>

        <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
          <Card.Content className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="field-stack">
              <label className="text-sm font-medium">Invoice</label>
              <NativeSelect fullWidth>
                <NativeSelect.Trigger value={selectedInvoiceId} onChange={(event) => setSelectedInvoiceId(event.target.value)}>
                  {snapshot.billingBackoffice.invoices.map((invoice) => (
                    <NativeSelect.Option key={invoice.id} value={invoice.id}>
                      {invoice.memberName} · {invoice.status}
                    </NativeSelect.Option>
                  ))}
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
            </div>
            <div className="field-stack">
              <Label>Webhook event</Label>
              <Input fullWidth value={webhookEventType} onChange={(event) => setWebhookEventType(event.target.value)} />
            </div>
            <div className="field-stack">
              <Label>Provider ref</Label>
              <Input fullWidth value={providerReference} onChange={(event) => setProviderReference(event.target.value)} />
            </div>
            <div className="field-stack">
              <Label>Payload</Label>
              <Input fullWidth value={payloadSummary} onChange={(event) => setPayloadSummary(event.target.value)} />
            </div>
            <div className="field-stack">
              <Label>Webhook status</Label>
              <NativeSelect fullWidth>
                <NativeSelect.Trigger value={webhookStatus} onChange={(event) => setWebhookStatus(event.target.value as typeof webhookStatus)}>
                  <NativeSelect.Option value="received">Received</NativeSelect.Option>
                  <NativeSelect.Option value="processed">Processed</NativeSelect.Option>
                  <NativeSelect.Option value="failed">Failed</NativeSelect.Option>
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
            </div>
            <div className="field-stack">
              <Label>Refund bedrag</Label>
              <Input fullWidth type="number" value={String(refundAmountCents)} onChange={(event) => setRefundAmountCents(Number(event.target.value || "0"))} />
            </div>
            <div className="field-stack">
              <Label>Refund reden</Label>
              <Input fullWidth value={refundReason} onChange={(event) => setRefundReason(event.target.value)} />
            </div>
            <div className="field-stack">
              <Label>Reconcile notitie</Label>
              <Input fullWidth value={reconcileNote} onChange={(event) => setReconcileNote(event.target.value)} />
            </div>
          </Card.Content>
          <Card.Content className="flex flex-wrap gap-2 pt-0">
            <Button
              isDisabled={isPending || !selectedInvoiceId}
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
                    toast.success("Webhook opgeslagen.");
                    router.refresh();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Webhook opslaan mislukt.");
                  }
                })
              }
            >
              Webhook registreren
            </Button>
            <Button
              isDisabled={isPending}
              variant="ghost"
              onPress={() =>
                startTransition(async () => {
                  try {
                    await submitDashboardMutation("/api/platform/billing-backoffice", {
                      operation: "reconcile",
                      note: reconcileNote,
                    });
                    toast.success("Reconciliatie gedraaid.");
                    router.refresh();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Reconciliatie mislukt.");
                  }
                })
              }
            >
              Reconciliëren
            </Button>
          </Card.Content>
        </Card>
      </PageSection>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
        <PageSection
          title="Betalingen"
          description="Billingprofiel, actieve betaalflows en uitbetalingsstatus."
        >
          <div className="grid gap-4">
            <Card className="rounded-2xl border-border/80 bg-surface-secondary">
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
                      {method}
                    </Chip>
                  ))}
                </div>
              </Card.Content>
            </Card>

            <Card className="rounded-2xl border-border/80 bg-surface-secondary">
              <Card.Content className="space-y-2">
                <p className="text-muted text-sm">Support</p>
                <p className="font-medium">{snapshot.payments.supportEmail}</p>
                <p className="text-muted text-sm">
                  {snapshot.payments.settlementLabel} · {snapshot.payments.profileId}
                </p>
              </Card.Content>
            </Card>
          </div>
        </PageSection>

        <LazyPlatformWorkbench sections={["payments"]} showLaunchHeader={false} snapshot={snapshot} />
      </div>
    </div>
  );
}
