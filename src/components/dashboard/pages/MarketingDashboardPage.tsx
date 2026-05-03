"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Chip, Input, Label } from "@heroui/react";
import { Button } from "@/components/dashboard/HydrationSafeButton";
import { NativeSelect } from "@/components/dashboard/HydrationSafeNativeSelect";
import { Segment } from "@/components/dashboard/HydrationSafeSegment";
import { toast } from "sonner";
import { submitDashboardMutation } from "@/components/dashboard/dashboard-client-helpers";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import {
  DisabledActionReason,
  EmptyPanel,
  PageSection,
  formatDateTime,
  statusChip,
  type DashboardPageProps,
} from "@/components/dashboard/shared";
import {
  getLeadAutomationTriggerLabel,
  getLeadSourceLabel,
  getLeadStageLabel,
  getLeadTaskStatusLabel,
  getLeadTaskTypeLabel,
  getMemberStatusLabel,
  getWaiverStatusLabel,
} from "@/lib/ui-labels";
import { formatEuroFromCents, parseEuroInputToCents } from "@/lib/currency";

export function MarketingDashboardPage({ snapshot }: DashboardPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const totalCapacity = snapshot.classSessions.reduce(
    (sum, classSession) => sum + classSession.capacity,
    0,
  );
  const confirmedBookings = snapshot.bookings.filter((booking) =>
    ["confirmed", "checked_in"].includes(booking.status),
  );
  const occupancy =
    totalCapacity === 0
      ? 0
      : Math.round((confirmedBookings.length / totalCapacity) * 100);
  const marketingFeatures = snapshot.featureFlags.filter(
    (feature) => feature.dashboardPage === "marketing",
  );
  const [emailSenderName, setEmailSenderName] = useState(
    snapshot.marketingWorkspace.emailSenderName,
  );
  const [emailReplyTo, setEmailReplyTo] = useState(snapshot.marketingWorkspace.emailReplyTo);
  const [promotionHeadline, setPromotionHeadline] = useState(
    snapshot.marketingWorkspace.promotionHeadline,
  );
  const [leadPipelineLabel, setLeadPipelineLabel] = useState(
    snapshot.marketingWorkspace.leadPipelineLabel,
  );
  const [automationCadence, setAutomationCadence] = useState(
    snapshot.marketingWorkspace.automationCadence,
  );
  const [leadFullName, setLeadFullName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadSource, setLeadSource] = useState<"website" | "instagram" | "referral" | "walk_in" | "meta_ads" | "booking">("website");
  const [leadStage, setLeadStage] = useState<"new" | "contacted" | "trial_scheduled" | "won" | "lost">("new");
  const [leadInterest, setLeadInterest] = useState("");
  const [leadNotes, setLeadNotes] = useState("");
  const [leadExpectedValueInput, setLeadExpectedValueInput] = useState(
    formatEuroFromCents(0),
  );
  const [selectedLeadId, setSelectedLeadId] = useState(snapshot.leads[0]?.id ?? "");
  const [selectedMembershipPlanId, setSelectedMembershipPlanId] = useState(
    snapshot.membershipPlans[0]?.id ?? "",
  );
  const [selectedLocationId, setSelectedLocationId] = useState(snapshot.locations[0]?.id ?? "");
  const [conversionStatus, setConversionStatus] = useState<"active" | "trial" | "paused" | "archived">("trial");
  const [conversionWaiverStatus, setConversionWaiverStatus] = useState<"complete" | "pending">("pending");
  const [automationTrigger, setAutomationTrigger] = useState<"manual" | "schedule" | "booking_cancellation">("manual");
  const [marketingFormView, setMarketingFormView] = useState<
    "lead-intake" | "lead-conversion" | "marketing-setup"
  >("lead-intake");

  useEffect(() => {
    setEmailSenderName(snapshot.marketingWorkspace.emailSenderName);
    setEmailReplyTo(snapshot.marketingWorkspace.emailReplyTo);
    setPromotionHeadline(snapshot.marketingWorkspace.promotionHeadline);
    setLeadPipelineLabel(snapshot.marketingWorkspace.leadPipelineLabel);
    setAutomationCadence(snapshot.marketingWorkspace.automationCadence);
    setSelectedLeadId(snapshot.leads[0]?.id ?? "");
    setSelectedMembershipPlanId(snapshot.membershipPlans[0]?.id ?? "");
    setSelectedLocationId(snapshot.locations[0]?.id ?? "");
  }, [snapshot.leads, snapshot.locations, snapshot.marketingWorkspace, snapshot.membershipPlans]);
  const conversionDisabledReason = isPending
    ? "Even wachten: er loopt al een actie."
    : !selectedLeadId || !selectedMembershipPlanId || !selectedLocationId
      ? "Kies eerst een aanvraag, contract en vestiging voordat je omzet naar lid."
      : null;
  const leadExpectedValueCents = parseEuroInputToCents(leadExpectedValueInput);

  return (
    <div className="section-stack">
      <div className="section-stack">
        <Segment
          aria-label="Marketing formulieren"
          className="w-full max-w-3xl"
          selectedKey={marketingFormView}
          size="sm"
          onSelectionChange={(key) =>
            setMarketingFormView(String(key) as typeof marketingFormView)
          }
        >
          <Segment.Item id="lead-intake">Nieuwe aanvraag</Segment.Item>
          <Segment.Item id="lead-conversion">Conversie</Segment.Item>
          <Segment.Item id="marketing-setup">Instellingen</Segment.Item>
        </Segment>

        {marketingFormView === "lead-intake" ? (
        <PageSection
          title="Nieuwe aanvraag"
          description="Zet nieuwe aanvragen direct in je opvolgproces zonder extern CRM."
          actions={
            <Button
              isDisabled={isPending}
              variant="outline"
              onPress={() =>
                startTransition(async () => {
                  try {
                    await submitDashboardMutation("/api/platform/leads", {
                      fullName: leadFullName,
                      email: leadEmail,
                      phone: leadPhone,
                      source: leadSource,
                      stage: leadStage,
                      interest: leadInterest,
                      notes: leadNotes || undefined,
                      expectedValueCents: leadExpectedValueCents || undefined,
                    });
                    setLeadFullName("");
                    setLeadEmail("");
                    setLeadPhone("");
                    setLeadInterest("");
                    setLeadNotes("");
                    setLeadExpectedValueInput(formatEuroFromCents(0));
                    toast.success("Aanvraag toegevoegd.");
                    router.refresh();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Aanvraag toevoegen mislukt.");
                  }
                })
              }
            >
              {isPending ? "Opslaan..." : "Aanvraag toevoegen"}
            </Button>
          }
        >
          <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
            <Card.Content className="grid gap-4 md:grid-cols-2">
              <div className="field-stack">
                <Label>Naam</Label>
                <Input fullWidth value={leadFullName} onChange={(event) => setLeadFullName(event.target.value)} />
              </div>
              <div className="field-stack">
                <Label>E-mail</Label>
                <Input fullWidth type="email" value={leadEmail} onChange={(event) => setLeadEmail(event.target.value)} />
              </div>
              <div className="field-stack">
                <Label>Telefoon</Label>
                <Input fullWidth value={leadPhone} onChange={(event) => setLeadPhone(event.target.value)} />
              </div>
              <div className="field-stack">
                <Label>Interesse</Label>
                <Input fullWidth value={leadInterest} onChange={(event) => setLeadInterest(event.target.value)} />
              </div>
              <div className="field-stack">
                <label className="text-sm font-medium">Bron</label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    value={leadSource}
                    onChange={(event) => setLeadSource(event.target.value as typeof leadSource)}
                  >
                    {(["website", "instagram", "referral", "walk_in", "meta_ads", "booking"] as const).map((source) => (
                      <NativeSelect.Option key={source} value={source}>
                        {getLeadSourceLabel(source)}
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <div className="field-stack">
                <label className="text-sm font-medium">Fase</label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    value={leadStage}
                    onChange={(event) => setLeadStage(event.target.value as typeof leadStage)}
                  >
                    {(["new", "contacted", "trial_scheduled", "won", "lost"] as const).map((stage) => (
                      <NativeSelect.Option key={stage} value={stage}>
                        {getLeadStageLabel(stage)}
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <div className="field-stack">
                <Label>Verwachte waarde (€)</Label>
                <Input
                  fullWidth
                  inputMode="decimal"
                  placeholder="€ 99,00"
                  type="text"
                  value={leadExpectedValueInput}
                  onBlur={() =>
                    setLeadExpectedValueInput(formatEuroFromCents(leadExpectedValueCents))
                  }
                  onChange={(event) => setLeadExpectedValueInput(event.target.value)}
                />
              </div>
              <div className="field-stack md:col-span-2">
                <Label>Notities</Label>
                <Input fullWidth value={leadNotes} onChange={(event) => setLeadNotes(event.target.value)} />
              </div>
            </Card.Content>
          </Card>
        </PageSection>
        ) : null}

        {marketingFormView === "lead-conversion" ? (
        <PageSection
          title="Aanvraag omzetten"
          description="Zet een warme aanvraag direct om naar een lid met contract en vestiging."
          actions={
            <div className="flex flex-col items-start gap-2 md:items-end">
              <Button
                isDisabled={Boolean(conversionDisabledReason)}
                variant="outline"
                onPress={() =>
                  startTransition(async () => {
                    try {
                      await submitDashboardMutation(
                        "/api/platform/leads",
                        {
                          operation: "convert",
                          leadId: selectedLeadId,
                          membershipPlanId: selectedMembershipPlanId,
                          homeLocationId: selectedLocationId,
                          status: conversionStatus,
                          tags: ["lead-converted"],
                          waiverStatus: conversionWaiverStatus,
                        },
                        { method: "PATCH" },
                      );
                      toast.success("Aanvraag omgezet naar lid.");
                      router.refresh();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Aanvraag omzetten mislukt.");
                    }
                  })
                }
              >
                {isPending ? "Omzetten..." : "Aanvraag omzetten"}
              </Button>
              <DisabledActionReason reason={conversionDisabledReason} />
            </div>
          }
        >
          <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
            <Card.Content className="grid gap-4">
              <div className="field-stack">
                <label className="text-sm font-medium">Aanvraag</label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    value={selectedLeadId}
                    onChange={(event) => setSelectedLeadId(event.target.value)}
                  >
                    {snapshot.leads.map((lead) => (
                      <NativeSelect.Option key={lead.id} value={lead.id}>
                        {lead.fullName} · {getLeadStageLabel(lead.stage)}
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <div className="field-stack">
                <label className="text-sm font-medium">Contract</label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    value={selectedMembershipPlanId}
                    onChange={(event) => setSelectedMembershipPlanId(event.target.value)}
                  >
                    {snapshot.membershipPlans.map((plan) => (
                      <NativeSelect.Option key={plan.id} value={plan.id}>
                        {plan.name}
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <div className="field-stack">
                <label className="text-sm font-medium">Vestiging</label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    value={selectedLocationId}
                    onChange={(event) => setSelectedLocationId(event.target.value)}
                  >
                    {snapshot.locations.map((location) => (
                      <NativeSelect.Option key={location.id} value={location.id}>
                        {location.name}
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <div className="field-stack">
                <label className="text-sm font-medium">Lidstatus</label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    value={conversionStatus}
                    onChange={(event) =>
                      setConversionStatus(event.target.value as typeof conversionStatus)
                    }
                  >
                    {(["trial", "active", "paused", "archived"] as const).map((status) => (
                      <NativeSelect.Option key={status} value={status}>
                        {getMemberStatusLabel(status)}
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <div className="field-stack">
                <label className="text-sm font-medium">Toestemmingsstatus</label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    value={conversionWaiverStatus}
                    onChange={(event) =>
                      setConversionWaiverStatus(
                        event.target.value as typeof conversionWaiverStatus,
                      )
                    }
                  >
                    {(["pending", "complete"] as const).map((status) => (
                      <NativeSelect.Option key={status} value={status}>
                        {getWaiverStatusLabel(status)}
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
            </Card.Content>
          </Card>
        </PageSection>
        ) : null}

        {marketingFormView === "marketing-setup" ? (
      <PageSection
        title="Marketing instellen"
        description="Leg campagnes, aanvraagopvolging en e-mailrouting vast zodat marketing niet los hangt van je live clubdata."
        actions={
          <Button
            isDisabled={isPending}
            variant="outline"
            onPress={() =>
              startTransition(async () => {
                try {
                  await submitDashboardMutation("/api/platform/marketing-settings", {
                    emailSenderName,
                    emailReplyTo,
                    promotionHeadline,
                    leadPipelineLabel,
                    automationCadence,
                  });
                  toast.success("Marketinginstellingen opgeslagen.");
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Marketinginstellingen opslaan mislukt.",
                  );
                }
              })
            }
          >
            {isPending ? "Opslaan..." : "Marketing opslaan"}
          </Button>
        }
      >
        <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
          <Card.Content className="grid gap-4 md:grid-cols-2">
            <div className="field-stack">
              <Label>Afzendernaam</Label>
              <Input
                fullWidth
                value={emailSenderName}
                onChange={(event) => setEmailSenderName(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Antwoordadres</Label>
              <Input
                fullWidth
                value={emailReplyTo}
                onChange={(event) => setEmailReplyTo(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Promotiekop</Label>
              <Input
                fullWidth
                value={promotionHeadline}
                onChange={(event) => setPromotionHeadline(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Aanvragenproces</Label>
              <Input
                fullWidth
                value={leadPipelineLabel}
                onChange={(event) => setLeadPipelineLabel(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <label className="text-sm font-medium">Ritme opvolging</label>
              <NativeSelect fullWidth>
                <NativeSelect.Trigger
                  value={automationCadence}
                  onChange={(event) =>
                    setAutomationCadence(
                      event.target.value as typeof snapshot.marketingWorkspace.automationCadence,
                    )
                  }
                >
                  <NativeSelect.Option value="weekly">Wekelijks</NativeSelect.Option>
                  <NativeSelect.Option value="biweekly">Tweewekelijks</NativeSelect.Option>
                  <NativeSelect.Option value="monthly">Maandelijks</NativeSelect.Option>
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
            </div>
          </Card.Content>
        </Card>
      </PageSection>
        ) : null}
      </div>

      <div className="section-stack">
        <PageSection
          title="Aanvragenproces"
          description="Overzicht van alle warme contacten en hun huidige fase."
        >
          <div className="grid gap-3">
            {snapshot.leads.length > 0 ? (
              snapshot.leads.map((lead) => (
                <Card key={lead.id} className="rounded-2xl border-border/80 bg-surface-secondary">
                  <Card.Content className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{lead.fullName}</p>
                      <span className="text-muted text-sm">{getLeadStageLabel(lead.stage)}</span>
                    </div>
                    <p className="text-muted text-sm">{lead.email} · {lead.phone}</p>
                    <p className="text-muted text-sm">
                      {getLeadSourceLabel(lead.source)} · {lead.interest}
                      {lead.convertedMemberId ? " · geconverteerd" : ""}
                    </p>
                  </Card.Content>
                </Card>
              ))
            ) : (
              <Card className="rounded-2xl border-border/80 bg-surface-secondary">
                <Card.Content className="text-muted text-sm">
                  Nog geen aanvragen toegevoegd.
                </Card.Content>
              </Card>
            )}
          </div>
        </PageSection>

        <PageSection
          title="Aanvragen opvolgen"
          description="Maak opvolgtaken op basis van warme aanvragen, afgebroken reserveringen en je planning."
          actions={
            <div className="flex flex-wrap gap-2">
              <NativeSelect fullWidth>
                <NativeSelect.Trigger
                  value={automationTrigger}
                  onChange={(event) =>
                    setAutomationTrigger(event.target.value as typeof automationTrigger)
                  }
                >
                  {(["manual", "schedule", "booking_cancellation"] as const).map((trigger) => (
                    <NativeSelect.Option key={trigger} value={trigger}>
                      {getLeadAutomationTriggerLabel(trigger)}
                    </NativeSelect.Option>
                  ))}
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
              <Button
                isDisabled={isPending}
                variant="outline"
                onPress={() =>
                  startTransition(async () => {
                    try {
                      await submitDashboardMutation("/api/platform/lead-automation", {
                        trigger: automationTrigger,
                      });
                      toast.success("Aanvraagopvolging gedraaid.");
                      router.refresh();
                    } catch (error) {
                      toast.error(
                        error instanceof Error ? error.message : "Opvolging draaien mislukt.",
                      );
                    }
                  })
                }
              >
                {isPending ? "Draaien..." : "Opvolging draaien"}
              </Button>
            </div>
          }
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl border-border/80 bg-surface-secondary">
              <Card.Content className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">Opvolgtaken</p>
                  <Chip size="sm" variant="soft">
                    {snapshot.leadAutomation.tasks.length}
                  </Chip>
                </div>
                {snapshot.leadAutomation.tasks.length > 0 ? (
                  <div className="grid gap-3">
                    {snapshot.leadAutomation.tasks.slice(0, 6).map((task) => {
                      const chip = statusChip(task.status);

                      return (
                        <div key={task.id} className="rounded-2xl border border-border/70 bg-surface p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{task.title}</p>
                              <p className="text-muted text-sm">
                                {getLeadTaskTypeLabel(task.type)} · {getLeadSourceLabel(task.source)}
                              </p>
                            </div>
                            <Chip color={chip.color} size="sm" variant={chip.variant}>
                              {getLeadTaskStatusLabel(task.status)}
                            </Chip>
                          </div>
                          <p className="text-muted mt-2 text-sm">
                            Vervalt {formatDateTime(task.dueAt)}
                            {task.assignedStaffName ? ` · ${task.assignedStaffName}` : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyPanel
                    title="Nog geen opvolgtaken"
                    description="Nieuwe aanvraagopvolgingen en afgebroken reserveringen verschijnen hier."
                  />
                )}
              </Card.Content>
            </Card>

            <Card className="rounded-2xl border-border/80 bg-surface-secondary">
              <Card.Content className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">Campagneherkomst en opvolging</p>
                  <Chip size="sm" variant="tertiary">
                    {snapshot.leadAutomation.lastRunAt
                      ? formatDateTime(snapshot.leadAutomation.lastRunAt)
                      : "Nog niet gedraaid"}
                  </Chip>
                </div>
                <div className="grid gap-3">
                  {snapshot.leadAutomation.attributions.slice(0, 4).map((attribution) => (
                    <div key={attribution.id} className="rounded-2xl border border-border/70 bg-surface p-4">
                      <p className="font-medium">{attribution.campaignLabel}</p>
                      <p className="text-muted text-sm">
                        {getLeadSourceLabel(attribution.source)} · {attribution.medium}
                      </p>
                    </div>
                  ))}
                  {snapshot.leadAutomation.runs.slice(0, 3).map((run) => (
                    <div key={run.id} className="rounded-2xl border border-border/70 bg-surface p-4">
                      <p className="font-medium">{getLeadAutomationTriggerLabel(run.trigger)}</p>
                      <p className="text-muted text-sm">
                        {run.createdTasks} nieuwe taken · {formatDateTime(run.createdAt)}
                      </p>
                    </div>
                  ))}
                  {snapshot.leadAutomation.attributions.length === 0 &&
                  snapshot.leadAutomation.runs.length === 0 ? (
                    <EmptyPanel
                      title="Nog geen marketingtelemetrie"
                      description="Aanvraagbron, campagnelabels en automatische opvolgingen verschijnen hier."
                    />
                  ) : null}
                </div>
              </Card.Content>
            </Card>
          </div>
        </PageSection>

        <PageSection
          title="Marketinginzichten"
          description="Signalen uit reserveringen, leden en conversiedruk voor je campagnes."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-2xl border-border/80 bg-surface-secondary">
              <Card.Content className="space-y-2">
                <p className="text-muted text-sm">Bezetting</p>
                <p className="text-3xl font-semibold">{occupancy}%</p>
                <p className="text-muted text-sm">
                  Gebruik dit om drukke en stille lesmomenten sneller te herkennen.
                </p>
              </Card.Content>
            </Card>
            <Card className="rounded-2xl border-border/80 bg-surface-secondary">
              <Card.Content className="space-y-2">
                <p className="text-muted text-sm">Proefleden</p>
                <p className="text-3xl font-semibold">
                  {snapshot.members.filter((member) => member.status === "trial").length}
                </p>
                <p className="text-muted text-sm">
                  Proefleden zijn je meest directe conversielijst voor opvolging.
                </p>
              </Card.Content>
            </Card>
          </div>
        </PageSection>

        <PageSection
          title="Uitgaande berichten"
          description="Houd promoties en opvolging gekoppeld aan echte lessen en ledenstatus."
        >
          <Card className="rounded-2xl border-border/80 bg-surface-secondary">
            <Card.Content className="space-y-2">
              <p className="text-sm leading-6">{snapshot.notificationPreview}</p>
            </Card.Content>
          </Card>
        </PageSection>
      </div>

      <PageSection
        title="Marketingmodules"
        description="Compact overzicht van campagnes, promoties en aanvragen."
      >
        <FeatureModuleBoard currentPage="marketing" features={marketingFeatures} snapshot={snapshot} />
      </PageSection>
    </div>
  );
}
