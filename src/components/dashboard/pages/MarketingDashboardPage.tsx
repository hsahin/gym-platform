"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Input, Label } from "@heroui/react";
import { NativeSelect } from "@heroui-pro/react/native-select";
import { toast } from "sonner";
import { submitDashboardMutation } from "@/components/dashboard/dashboard-client-helpers";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import {
  EmptyPanel,
  PageSection,
  formatDateTime,
  statusChip,
  type DashboardPageProps,
} from "@/components/dashboard/shared";

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
  const [leadExpectedValueCents, setLeadExpectedValueCents] = useState(0);
  const [selectedLeadId, setSelectedLeadId] = useState(snapshot.leads[0]?.id ?? "");
  const [selectedMembershipPlanId, setSelectedMembershipPlanId] = useState(
    snapshot.membershipPlans[0]?.id ?? "",
  );
  const [selectedLocationId, setSelectedLocationId] = useState(snapshot.locations[0]?.id ?? "");
  const [conversionStatus, setConversionStatus] = useState<"active" | "trial" | "paused" | "archived">("trial");
  const [conversionWaiverStatus, setConversionWaiverStatus] = useState<"complete" | "pending">("pending");
  const [automationTrigger, setAutomationTrigger] = useState<"manual" | "schedule" | "booking_cancellation">("manual");

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

  return (
    <div className="section-stack">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <PageSection
          title="Lead intake"
          description="Zet nieuwe aanvragen direct in de pipeline zonder extern CRM."
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
                    setLeadExpectedValueCents(0);
                    toast.success("Lead toegevoegd.");
                    router.refresh();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Lead toevoegen mislukt.");
                  }
                })
              }
            >
              {isPending ? "Opslaan..." : "Lead toevoegen"}
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
                    <NativeSelect.Option value="website">Website</NativeSelect.Option>
                    <NativeSelect.Option value="instagram">Instagram</NativeSelect.Option>
                    <NativeSelect.Option value="referral">Referral</NativeSelect.Option>
                    <NativeSelect.Option value="walk_in">Walk-in</NativeSelect.Option>
                    <NativeSelect.Option value="meta_ads">Meta ads</NativeSelect.Option>
                    <NativeSelect.Option value="booking">Booking</NativeSelect.Option>
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <div className="field-stack">
                <label className="text-sm font-medium">Stage</label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    value={leadStage}
                    onChange={(event) => setLeadStage(event.target.value as typeof leadStage)}
                  >
                    <NativeSelect.Option value="new">Nieuw</NativeSelect.Option>
                    <NativeSelect.Option value="contacted">Gecontacteerd</NativeSelect.Option>
                    <NativeSelect.Option value="trial_scheduled">Trial gepland</NativeSelect.Option>
                    <NativeSelect.Option value="won">Gewonnen</NativeSelect.Option>
                    <NativeSelect.Option value="lost">Verloren</NativeSelect.Option>
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <div className="field-stack">
                <Label>Verwachte waarde (cent)</Label>
                <Input
                  fullWidth
                  min={0}
                  type="number"
                  value={String(leadExpectedValueCents)}
                  onChange={(event) => setLeadExpectedValueCents(Number(event.target.value || "0"))}
                />
              </div>
              <div className="field-stack md:col-span-2">
                <Label>Notities</Label>
                <Input fullWidth value={leadNotes} onChange={(event) => setLeadNotes(event.target.value)} />
              </div>
            </Card.Content>
          </Card>
        </PageSection>

        <PageSection
          title="Lead conversie"
          description="Zet een warme lead direct om naar een member met contract en vestiging."
          actions={
            <Button
              isDisabled={
                isPending ||
                !selectedLeadId ||
                !selectedMembershipPlanId ||
                !selectedLocationId
              }
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
                    toast.success("Lead omgezet naar member.");
                    router.refresh();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Lead conversie mislukt.");
                  }
                })
              }
            >
              {isPending ? "Omzetten..." : "Converteer lead"}
            </Button>
          }
        >
          <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
            <Card.Content className="grid gap-4">
              <div className="field-stack">
                <label className="text-sm font-medium">Lead</label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    value={selectedLeadId}
                    onChange={(event) => setSelectedLeadId(event.target.value)}
                  >
                    {snapshot.leads.map((lead) => (
                      <NativeSelect.Option key={lead.id} value={lead.id}>
                        {lead.fullName} · {lead.stage}
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
                <label className="text-sm font-medium">Member status</label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    value={conversionStatus}
                    onChange={(event) =>
                      setConversionStatus(event.target.value as typeof conversionStatus)
                    }
                  >
                    <NativeSelect.Option value="trial">Trial</NativeSelect.Option>
                    <NativeSelect.Option value="active">Actief</NativeSelect.Option>
                    <NativeSelect.Option value="paused">Gepauzeerd</NativeSelect.Option>
                    <NativeSelect.Option value="archived">Gearchiveerd</NativeSelect.Option>
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <div className="field-stack">
                <label className="text-sm font-medium">Waiver status</label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    value={conversionWaiverStatus}
                    onChange={(event) =>
                      setConversionWaiverStatus(
                        event.target.value as typeof conversionWaiverStatus,
                      )
                    }
                  >
                    <NativeSelect.Option value="pending">Pending</NativeSelect.Option>
                    <NativeSelect.Option value="complete">Complete</NativeSelect.Option>
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
            </Card.Content>
          </Card>
        </PageSection>
      </div>

      <PageSection
        title="Marketing setup"
        description="Leg campagnes, leadopvolging en e-mailrouting vast zodat marketing niet los hangt van je live clubdata."
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
              <Label>Email sender</Label>
              <Input
                fullWidth
                value={emailSenderName}
                onChange={(event) => setEmailSenderName(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Reply-to email</Label>
              <Input
                fullWidth
                value={emailReplyTo}
                onChange={(event) => setEmailReplyTo(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Promotion headline</Label>
              <Input
                fullWidth
                value={promotionHeadline}
                onChange={(event) => setPromotionHeadline(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Lead pipeline</Label>
              <Input
                fullWidth
                value={leadPipelineLabel}
                onChange={(event) => setLeadPipelineLabel(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <label className="text-sm font-medium">Automation cadence</label>
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <PageSection
          title="Lead pipeline"
          description="Overzicht van alle warme contacten en hun huidige stage."
        >
          <div className="grid gap-3">
            {snapshot.leads.length > 0 ? (
              snapshot.leads.map((lead) => (
                <Card key={lead.id} className="rounded-2xl border-border/80 bg-surface-secondary">
                  <Card.Content className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{lead.fullName}</p>
                      <span className="text-muted text-sm">{lead.stage}</span>
                    </div>
                    <p className="text-muted text-sm">{lead.email} · {lead.phone}</p>
                    <p className="text-muted text-sm">
                      {lead.source} · {lead.interest}
                      {lead.convertedMemberId ? " · geconverteerd" : ""}
                    </p>
                  </Card.Content>
                </Card>
              ))
            ) : (
              <Card className="rounded-2xl border-border/80 bg-surface-secondary">
                <Card.Content className="text-muted text-sm">
                  Nog geen leads toegevoegd.
                </Card.Content>
              </Card>
            )}
          </div>
        </PageSection>

        <PageSection
          title="Lead automations"
          description="Run nurture, abandoned booking en scheduled follow-up direct op tenantdata."
          actions={
            <div className="flex flex-wrap gap-2">
              <NativeSelect fullWidth>
                <NativeSelect.Trigger
                  value={automationTrigger}
                  onChange={(event) =>
                    setAutomationTrigger(event.target.value as typeof automationTrigger)
                  }
                >
                  <NativeSelect.Option value="manual">Handmatig</NativeSelect.Option>
                  <NativeSelect.Option value="schedule">Planning</NativeSelect.Option>
                  <NativeSelect.Option value="booking_cancellation">
                    Geannuleerde booking
                  </NativeSelect.Option>
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
                      toast.success("Lead automation gedraaid.");
                      router.refresh();
                    } catch (error) {
                      toast.error(
                        error instanceof Error ? error.message : "Automation draaien mislukt.",
                      );
                    }
                  })
                }
              >
                {isPending ? "Draaien..." : "Automation run"}
              </Button>
            </div>
          }
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl border-border/80 bg-surface-secondary">
              <Card.Content className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">Follow-up taken</p>
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
                                {task.type} · {task.source}
                              </p>
                            </div>
                            <Chip color={chip.color} size="sm" variant={chip.variant}>
                              {task.status}
                            </Chip>
                          </div>
                          <p className="text-muted mt-2 text-sm">
                            Due {formatDateTime(task.dueAt)}
                            {task.assignedStaffName ? ` · ${task.assignedStaffName}` : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyPanel
                    title="Nog geen automation taken"
                    description="Nieuwe nurture- en abandoned-booking taken verschijnen hier."
                  />
                )}
              </Card.Content>
            </Card>

            <Card className="rounded-2xl border-border/80 bg-surface-secondary">
              <Card.Content className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">Attributie en runs</p>
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
                        {attribution.source} · {attribution.medium}
                      </p>
                    </div>
                  ))}
                  {snapshot.leadAutomation.runs.slice(0, 3).map((run) => (
                    <div key={run.id} className="rounded-2xl border border-border/70 bg-surface p-4">
                      <p className="font-medium">{run.trigger}</p>
                      <p className="text-muted text-sm">
                        {run.createdTasks} nieuwe taken · {formatDateTime(run.createdAt)}
                      </p>
                    </div>
                  ))}
                  {snapshot.leadAutomation.attributions.length === 0 &&
                  snapshot.leadAutomation.runs.length === 0 ? (
                    <EmptyPanel
                      title="Nog geen marketingtelemetrie"
                      description="Leadbron, campaign labels en automation-runs verschijnen hier."
                    />
                  ) : null}
                </div>
              </Card.Content>
            </Card>
          </div>
        </PageSection>

        <PageSection
          title="Marketing signals"
          description="Campaign-ready signals pulled from live bookings, members and conversion pressure."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-2xl border-border/80 bg-surface-secondary">
              <Card.Content className="space-y-2">
                <p className="text-muted text-sm">Occupancy</p>
                <p className="text-3xl font-semibold">{occupancy}%</p>
                <p className="text-muted text-sm">
                  Use this to spot fill pressure and class timing issues.
                </p>
              </Card.Content>
            </Card>
            <Card className="rounded-2xl border-border/80 bg-surface-secondary">
              <Card.Content className="space-y-2">
                <p className="text-muted text-sm">Trials</p>
                <p className="text-3xl font-semibold">
                  {snapshot.members.filter((member) => member.status === "trial").length}
                </p>
                <p className="text-muted text-sm">
                  Trial members are the clearest short-term conversion queue.
                </p>
              </Card.Content>
            </Card>
          </div>
        </PageSection>

        <PageSection
          title="Outbound messaging"
          description="Keep promotions and follow-up anchored to real class supply and member state."
        >
          <Card className="rounded-2xl border-border/80 bg-surface-secondary">
            <Card.Content className="space-y-2">
              <p className="text-sm leading-6">{snapshot.notificationPreview}</p>
            </Card.Content>
          </Card>
        </PageSection>
      </div>

      <PageSection
        title="Marketing modules"
        description="Compact overzicht van campagnes, promoties en lead flows."
      >
        <FeatureModuleBoard currentPage="marketing" features={marketingFeatures} snapshot={snapshot} />
      </PageSection>
    </div>
  );
}
