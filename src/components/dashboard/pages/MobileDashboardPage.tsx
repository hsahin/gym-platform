"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages, QrCode, Smartphone, UserRoundCheck } from "lucide-react";
import { Card, Chip, Input, Label } from "@heroui/react";
import { Button } from "@/components/dashboard/HydrationSafeButton";
import { ListView } from "@/components/dashboard/HydrationSafeListView";
import { NativeSelect } from "@/components/dashboard/HydrationSafeNativeSelect";
import { toast } from "sonner";
import { submitDashboardMutation } from "@/components/dashboard/dashboard-client-helpers";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import {
  DisabledActionReason,
  EmptyPanel,
  formatDateTime,
  PageSection,
  type DashboardPageProps,
} from "@/components/dashboard/shared";
import {
  getEntityStatusLabel,
  getMemberStatusLabel,
  getReviewRequestStatusLabel,
} from "@/lib/ui-labels";
import { formatEuroFromCents } from "@/lib/currency";

function getReviewDecisionLabel(decision: "approved" | "rejected") {
  return decision === "approved" ? "Goedkeuren" : "Afwijzen";
}

export function MobileDashboardPage({ snapshot }: DashboardPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const mobileFeatures = snapshot.featureFlags.filter(
    (feature) => feature.dashboardPage === "mobile",
  );
  const [appDisplayName, setAppDisplayName] = useState(
    snapshot.mobileExperience.appDisplayName,
  );
  const [onboardingHeadline, setOnboardingHeadline] = useState(
    snapshot.mobileExperience.onboardingHeadline,
  );
  const [supportChannel, setSupportChannel] = useState(
    snapshot.mobileExperience.supportChannel,
  );
  const [primaryAccent, setPrimaryAccent] = useState(snapshot.mobileExperience.primaryAccent);
  const [checkInMode, setCheckInMode] = useState(snapshot.mobileExperience.checkInMode);
  const [whiteLabelDomain, setWhiteLabelDomain] = useState(
    snapshot.mobileExperience.whiteLabelDomain,
  );
  const [selectedMemberId, setSelectedMemberId] = useState(snapshot.members[0]?.id ?? "");
  const [selectedMemberName, setSelectedMemberName] = useState(snapshot.members[0]?.fullName ?? "");
  const [requestedMethodLabel, setRequestedMethodLabel] = useState("IBAN update via app");
  const [paymentMethodNote, setPaymentMethodNote] = useState("Lid wil nieuwe betaalmethode koppelen.");
  const [pauseStartsAt, setPauseStartsAt] = useState("2026-07-01T00:00:00.000Z");
  const [pauseEndsAt, setPauseEndsAt] = useState("2026-07-31T23:59:59.000Z");
  const [pauseReason, setPauseReason] = useState("Zomervakantie");
  const portalMembers = snapshot.members.filter((member) =>
    snapshot.memberPortalAccessMemberIds.includes(member.id),
  );
  const locationsById = new Map(snapshot.locations.map((location) => [location.id, location.name]));
  const mobileCheckInEnabled = mobileFeatures.find((feature) => feature.key === "mobile.checkin")?.enabled;
  const mobileMemberActionDisabledReason = isPending
    ? "Even wachten: er loopt al een actie."
    : !selectedMemberId
      ? "Kies eerst een lid voordat je een verzoek maakt."
      : null;

  useEffect(() => {
    setAppDisplayName(snapshot.mobileExperience.appDisplayName);
    setOnboardingHeadline(snapshot.mobileExperience.onboardingHeadline);
    setSupportChannel(snapshot.mobileExperience.supportChannel);
    setPrimaryAccent(snapshot.mobileExperience.primaryAccent);
    setCheckInMode(snapshot.mobileExperience.checkInMode);
    setWhiteLabelDomain(snapshot.mobileExperience.whiteLabelDomain);
    setSelectedMemberId(snapshot.members[0]?.id ?? "");
    setSelectedMemberName(snapshot.members[0]?.fullName ?? "");
  }, [snapshot.members, snapshot.mobileExperience]);

  return (
    <div className="section-stack">
      <PageSection
        title="Mobiele app instellen"
        description="Configureer je merkapp, welkomsttekst en aankomstervaring voor leden."
        actions={
          <Button
            isDisabled={isPending}
            variant="outline"
            onPress={() =>
              startTransition(async () => {
                try {
                  await submitDashboardMutation("/api/platform/mobile-settings", {
                    appDisplayName,
                    onboardingHeadline,
                    supportChannel,
                    primaryAccent,
                    checkInMode,
                    whiteLabelDomain,
                  });
                  toast.success("Mobiele instellingen opgeslagen.");
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Mobiele instellingen opslaan mislukt.",
                  );
                }
              })
            }
          >
            {isPending ? "Opslaan..." : "Mobiel opslaan"}
          </Button>
        }
      >
        <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
          <Card.Content className="grid gap-4 md:grid-cols-2">
            <div className="field-stack">
              <Label>Appnaam</Label>
              <Input
                fullWidth
                value={appDisplayName}
                onChange={(event) => setAppDisplayName(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Welkomstkop</Label>
              <Input
                fullWidth
                value={onboardingHeadline}
                onChange={(event) => setOnboardingHeadline(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Supportkanaal</Label>
              <Input
                fullWidth
                value={supportChannel}
                onChange={(event) => setSupportChannel(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Primaire accentkleur</Label>
              <Input
                fullWidth
                placeholder="#F97316"
                value={primaryAccent}
                onChange={(event) => setPrimaryAccent(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <label className="text-sm font-medium">Aankomstmodus</label>
              <NativeSelect fullWidth>
                <NativeSelect.Trigger
                  value={checkInMode}
                  onChange={(event) =>
                    setCheckInMode(
                      event.target.value as typeof snapshot.mobileExperience.checkInMode,
                    )
                  }
                >
                  <NativeSelect.Option value="qr">Alleen QR</NativeSelect.Option>
                  <NativeSelect.Option value="frontdesk">Alleen balie</NativeSelect.Option>
                  <NativeSelect.Option value="hybrid">Hybride</NativeSelect.Option>
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
            </div>
            <div className="field-stack">
              <Label>Merkapp-domein</Label>
              <Input
                fullWidth
                placeholder="app.jegym.nl"
                value={whiteLabelDomain}
                onChange={(event) => setWhiteLabelDomain(event.target.value)}
              />
            </div>
          </Card.Content>
        </Card>
      </PageSection>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {[
          {
            icon: Smartphone,
            label: "Ledenaccounts",
            value: String(portalMembers.length),
            helper: "Leden die nu al direct een app- of portalervaring kunnen krijgen.",
          },
          {
            icon: QrCode,
            label: "Mobiele aankomst",
            value: mobileCheckInEnabled ? "Actief" : "Uit",
            helper: "QR en mobiele aankomstroute voor lessen en studiobezoek.",
          },
          {
            icon: Languages,
            label: "Talen live",
            value: String(snapshot.supportedLanguages.length),
            helper: "Gebruik dit als basis voor een bredere ledenapp.",
          },
          {
            icon: UserRoundCheck,
            label: "Vestigingen zichtbaar",
            value: String(snapshot.locations.length),
            helper: "Vestigingen die direct in een mobiele clubselector kunnen landen.",
          },
        ].map((item) => (
          <Card key={item.label} className="rounded-[24px] border border-border/80 bg-surface shadow-none">
            <Card.Content className="space-y-3">
              <div className="flex items-center gap-2">
                <item.icon className="text-muted h-4 w-4" />
                <p className="text-sm font-medium">{item.label}</p>
              </div>
              <p className="text-3xl font-semibold">{item.value}</p>
              <p className="text-muted text-sm leading-6">{item.helper}</p>
            </Card.Content>
          </Card>
        ))}
      </div>

      <PageSection
        title="Leden klaar voor app-lancering"
        description="Leden met portaltoegang zijn de eerste groep die je direct kunt meenemen in mobiele trajecten."
      >
        {portalMembers.length > 0 ? (
          <ListView aria-label="Leden klaar voor app-lancering" items={portalMembers.slice(0, 6)}>
            {(member) => (
              <ListView.Item id={member.id} textValue={member.fullName}>
                <ListView.ItemContent>
                  <ListView.Title>{member.fullName}</ListView.Title>
                  <ListView.Description>
                    {member.email} · {getMemberStatusLabel(member.status)}
                  </ListView.Description>
                </ListView.ItemContent>
                <p className="text-muted text-xs">
                  {locationsById.get(member.homeLocationId) ?? member.homeLocationId}
                </p>
              </ListView.Item>
            )}
          </ListView>
        ) : (
          <EmptyPanel
            title="Nog geen app-kandidaten"
            description="Zodra je leden portaltoegang geeft, verschijnen ze hier als eerste groep."
          />
        )}
      </PageSection>

      <div className="section-stack">
        <PageSection
          title="Zelfserviceverzoeken"
          description="Laat leden betaalmethode-updates en pauzeverzoeken indienen zonder mailverkeer."
        >
          <div className="grid gap-4">
            <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
              <Card.Content className="grid gap-4 md:grid-cols-2">
                <div className="field-stack">
                  <label className="text-sm font-medium">Lid</label>
                  <NativeSelect fullWidth>
                    <NativeSelect.Trigger
                      value={selectedMemberId}
                      onChange={(event) => {
                        setSelectedMemberId(event.target.value);
                        const member = snapshot.members.find((entry) => entry.id === event.target.value);
                        setSelectedMemberName(member?.fullName ?? "");
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
                  <Label>Nieuwe betaalmethode</Label>
                  <Input fullWidth value={requestedMethodLabel} onChange={(event) => setRequestedMethodLabel(event.target.value)} />
                </div>
                <div className="field-stack md:col-span-2">
                  <Label>Notitie</Label>
                  <Input fullWidth value={paymentMethodNote} onChange={(event) => setPaymentMethodNote(event.target.value)} />
                </div>
              </Card.Content>
              <Card.Content className="space-y-2 pt-0">
                <Button
                  isDisabled={Boolean(mobileMemberActionDisabledReason)}
                  variant="outline"
                  onPress={() =>
                    startTransition(async () => {
                      try {
                        await submitDashboardMutation("/api/platform/mobile-self-service", {
                          operation: "request_payment_method_update",
                          memberId: selectedMemberId,
                          memberName: selectedMemberName,
                          requestedMethodLabel,
                          note: paymentMethodNote || undefined,
                        });
                        toast.success("Betaalmethodeverzoek toegevoegd.");
                        router.refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Verzoek toevoegen mislukt.",
                        );
                      }
                    })
                  }
                >
                  Betaalmethodeverzoek maken
                </Button>
                <DisabledActionReason reason={mobileMemberActionDisabledReason} />
              </Card.Content>
            </Card>

            <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
              <Card.Content className="grid gap-4 md:grid-cols-2">
                <div className="field-stack">
                  <Label>Pauze start</Label>
                  <Input fullWidth value={pauseStartsAt} onChange={(event) => setPauseStartsAt(event.target.value)} />
                </div>
                <div className="field-stack">
                  <Label>Pauze einde</Label>
                  <Input fullWidth value={pauseEndsAt} onChange={(event) => setPauseEndsAt(event.target.value)} />
                </div>
                <div className="field-stack md:col-span-2">
                  <Label>Reden</Label>
                  <Input fullWidth value={pauseReason} onChange={(event) => setPauseReason(event.target.value)} />
                </div>
              </Card.Content>
              <Card.Content className="space-y-2 pt-0">
                <Button
                  isDisabled={Boolean(mobileMemberActionDisabledReason)}
                  variant="outline"
                  onPress={() =>
                    startTransition(async () => {
                      try {
                        await submitDashboardMutation("/api/platform/mobile-self-service", {
                          operation: "request_pause",
                          memberId: selectedMemberId,
                          memberName: selectedMemberName,
                          startsAt: pauseStartsAt,
                          endsAt: pauseEndsAt,
                          reason: pauseReason,
                        });
                        toast.success("Pauzeverzoek toegevoegd.");
                        router.refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Pauzeverzoek mislukt.",
                        );
                      }
                    })
                  }
                >
                  Pauzeverzoek maken
                </Button>
                <DisabledActionReason reason={mobileMemberActionDisabledReason} />
              </Card.Content>
            </Card>

            <div className="grid gap-3">
              {snapshot.mobileSelfService.paymentMethodRequests.map((request) => (
                <Card key={request.id} className="rounded-2xl border-border/80 bg-surface-secondary">
                  <Card.Content className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{request.memberName}</p>
                        <p className="text-muted text-sm">{request.requestedMethodLabel}</p>
                      </div>
                      <Chip size="sm" variant={request.status === "pending" ? "soft" : "tertiary"}>
                        {getReviewRequestStatusLabel(request.status)}
                      </Chip>
                    </div>
                    <p className="text-muted text-sm">{request.note ?? "Geen notitie"}</p>
                    {request.status === "pending" ? (
                      <div className="flex flex-wrap gap-2">
                        {(["approved", "rejected"] as const).map((decision) => (
                          <Button
                            key={decision}
                            size="sm"
                            variant="outline"
                            onPress={() =>
                              startTransition(async () => {
                                try {
                                  await submitDashboardMutation("/api/platform/mobile-self-service", {
                                    operation: "review_payment_method_update",
                                    requestId: request.id,
                                    decision,
                                  });
                                  toast.success("Verzoek beoordeeld.");
                                  router.refresh();
                                } catch (error) {
                                  toast.error(
                                    error instanceof Error
                                      ? error.message
                                      : "Verzoek beoordelen mislukt.",
                                  );
                                }
                              })
                            }
                          >
                            {getReviewDecisionLabel(decision)}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </Card.Content>
                </Card>
              ))}

              {snapshot.mobileSelfService.pauseRequests.map((request) => (
                <Card key={request.id} className="rounded-2xl border-border/80 bg-surface-secondary">
                  <Card.Content className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{request.memberName}</p>
                        <p className="text-muted text-sm">
                          {formatDateTime(request.startsAt)} tot {formatDateTime(request.endsAt)}
                        </p>
                      </div>
                      <Chip size="sm" variant={request.status === "pending" ? "soft" : "tertiary"}>
                        {getReviewRequestStatusLabel(request.status)}
                      </Chip>
                    </div>
                    <p className="text-muted text-sm">{request.reason}</p>
                    {request.status === "pending" ? (
                      <div className="flex flex-wrap gap-2">
                        {(["approved", "rejected"] as const).map((decision) => (
                          <Button
                            key={decision}
                            size="sm"
                            variant="outline"
                            onPress={() =>
                              startTransition(async () => {
                                try {
                                  await submitDashboardMutation("/api/platform/mobile-self-service", {
                                    operation: "review_pause",
                                    requestId: request.id,
                                    decision,
                                  });
                                  toast.success("Pauzeverzoek beoordeeld.");
                                  router.refresh();
                                } catch (error) {
                                  toast.error(
                                    error instanceof Error
                                      ? error.message
                                      : "Pauzeverzoek beoordelen mislukt.",
                                  );
                                }
                              })
                            }
                          >
                            {getReviewDecisionLabel(decision)}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </Card.Content>
                </Card>
              ))}
            </div>
          </div>
        </PageSection>

        <PageSection
          title="Betalingsbewijzen en contracten"
          description="Alles wat leden in de app terugzien: betalingen, contracten en actieve documenten."
        >
          <div className="grid gap-4">
            <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
              <Card.Content className="space-y-3">
                <p className="font-medium">Recente betalingsbewijzen</p>
                {snapshot.mobileSelfService.receipts.length > 0 ? (
                  snapshot.mobileSelfService.receipts.map((receipt) => (
                    <div key={receipt.invoiceId} className="rounded-2xl border border-border/70 bg-surface p-4">
                      <p className="font-medium">{receipt.memberName}</p>
                      <p className="text-muted text-sm">
                        {receipt.description} · {formatEuroFromCents(receipt.amountCents)}
                      </p>
                      <p className="text-muted text-sm">{formatDateTime(receipt.paidAt)}</p>
                    </div>
                  ))
                ) : (
                  <EmptyPanel
                    title="Nog geen betalingsbewijzen"
                    description="Zodra facturen betaald zijn, komen betalingsbewijzen hier beschikbaar."
                  />
                )}
              </Card.Content>
            </Card>

            <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
              <Card.Content className="space-y-3">
                <p className="font-medium">Contracten in de app</p>
                {snapshot.mobileSelfService.contracts.length > 0 ? (
                  snapshot.mobileSelfService.contracts.map((contract) => (
                    <div key={contract.id} className="rounded-2xl border border-border/70 bg-surface p-4">
                      <p className="font-medium">{contract.memberName}</p>
                      <p className="text-muted text-sm">
                        {contract.contractName} · {contract.documentLabel}
                      </p>
                      <p className="text-muted text-sm">
                        {contract.documentUrl} · {getEntityStatusLabel(contract.status)}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyPanel
                    title="Nog geen contracten"
                    description="Contracten worden automatisch zichtbaar zodra leden zijn aangemaakt of goedgekeurd."
                  />
                )}
              </Card.Content>
            </Card>
          </div>
        </PageSection>
      </div>

      <PageSection
        title="Mobiele modules"
        description="Compact overzicht van merkapp, mobiele aankomst en coachinguitbreidingen."
      >
        <FeatureModuleBoard currentPage="mobile" features={mobileFeatures} snapshot={snapshot} />
      </PageSection>
    </div>
  );
}
