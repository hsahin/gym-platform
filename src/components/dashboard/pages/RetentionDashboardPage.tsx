"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Award, MessageSquareHeart, ShieldAlert, Users } from "lucide-react";
import { Card, Input, Label } from "@heroui/react";
import { Button } from "@/components/dashboard/HydrationSafeButton";
import { NativeSelect } from "@/components/dashboard/HydrationSafeNativeSelect";
import { Segment } from "@/components/dashboard/HydrationSafeSegment";
import { toast } from "sonner";
import {
  parseCommaList,
  submitDashboardMutation,
} from "@/components/dashboard/dashboard-client-helpers";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import {
  DisabledActionReason,
  EmptyPanel,
  PageSection,
  formatDateTime,
  type DashboardPageProps,
} from "@/components/dashboard/shared";

export function RetentionDashboardPage({ snapshot }: DashboardPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const retentionFeatures = snapshot.featureFlags.filter(
    (feature) => feature.dashboardPage === "retention",
  );
  const [retentionCadence, setRetentionCadence] = useState(
    snapshot.retentionWorkspace.retentionCadence,
  );
  const [communityChannel, setCommunityChannel] = useState(
    snapshot.retentionWorkspace.communityChannel,
  );
  const [challengeTheme, setChallengeTheme] = useState(
    snapshot.retentionWorkspace.challengeTheme,
  );
  const [questionnaireTrigger, setQuestionnaireTrigger] = useState(
    snapshot.retentionWorkspace.questionnaireTrigger,
  );
  const [proContentPath, setProContentPath] = useState(
    snapshot.retentionWorkspace.proContentPath,
  );
  const [fitZoneOffer, setFitZoneOffer] = useState(snapshot.retentionWorkspace.fitZoneOffer);
  const [groupName, setGroupName] = useState("Startgroep nieuwe leden");
  const [groupChannel, setGroupChannel] = useState("WhatsApp");
  const [groupDescription, setGroupDescription] = useState("Nieuwe leden die elkaar wekelijks motiveren.");
  const [groupMemberIds, setGroupMemberIds] = useState("");
  const [challengeTitle, setChallengeTitle] = useState("30 dagen consistent trainen");
  const [challengeRewardLabel, setChallengeRewardLabel] = useState("Gratis herstelshake");
  const [challengeStartsAt, setChallengeStartsAt] = useState("2026-05-01T00:00:00.000Z");
  const [challengeEndsAt, setChallengeEndsAt] = useState("2026-05-30T23:59:59.000Z");
  const [challengeMemberIds, setChallengeMemberIds] = useState("");
  const [questionnaireTitle, setQuestionnaireTitle] = useState("30-dagen check-in");
  const [questionnaireQuestions, setQuestionnaireQuestions] = useState(
    "Hoe ervaar je de coaching?,Wat houdt je nog tegen om vaker te komen?",
  );
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState(
    snapshot.communityHub.questionnaires[0]?.id ?? "",
  );
  const [responseMemberId, setResponseMemberId] = useState(snapshot.members[0]?.id ?? "");
  const [responseAnswers, setResponseAnswers] = useState(
    "Ik ben positief over de sfeer,Ik wil graag meer ochtendlessen",
  );
  const [retentionFormView, setRetentionFormView] = useState<
    "community" | "questionnaires"
  >("community");
  const trialMembers = snapshot.members.filter((member) => member.status === "trial").length;
  const pendingWaivers = snapshot.members.filter((member) => member.waiverStatus === "pending").length;
  const waitlistBookings = snapshot.bookings.filter((booking) => booking.status === "waitlisted").length;
  const activeMembers = snapshot.members.filter((member) => member.status === "active").length;

  useEffect(() => {
    setRetentionCadence(snapshot.retentionWorkspace.retentionCadence);
    setCommunityChannel(snapshot.retentionWorkspace.communityChannel);
    setChallengeTheme(snapshot.retentionWorkspace.challengeTheme);
    setQuestionnaireTrigger(snapshot.retentionWorkspace.questionnaireTrigger);
    setProContentPath(snapshot.retentionWorkspace.proContentPath);
    setFitZoneOffer(snapshot.retentionWorkspace.fitZoneOffer);
    setSelectedQuestionnaireId(snapshot.communityHub.questionnaires[0]?.id ?? "");
    setResponseMemberId(snapshot.members[0]?.id ?? "");
  }, [snapshot.communityHub.questionnaires, snapshot.members, snapshot.retentionWorkspace]);
  const questionnaireResponseDisabledReason = isPending
    ? "Even wachten: er loopt al een actie."
    : !selectedQuestionnaireId || !responseMemberId
      ? "Kies eerst een vragenlijst en lid voordat je een reactie opslaat."
      : null;

  return (
    <div className="section-stack">
      <PageSection
        title="Retentie instellen"
        description="Bepaal hoe clubgroepen, uitdagingen, vragenlijsten en ledencontent in jouw gym moeten landen."
        actions={
          <Button
            isDisabled={isPending}
            variant="outline"
            onPress={() =>
              startTransition(async () => {
                try {
                  await submitDashboardMutation("/api/platform/retention-settings", {
                    retentionCadence,
                    communityChannel,
                    challengeTheme,
                    questionnaireTrigger,
                    proContentPath,
                    fitZoneOffer,
                  });
                  toast.success("Retentie-instellingen opgeslagen.");
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Retentie-instellingen opslaan mislukt.",
                  );
                }
              })
            }
          >
            {isPending ? "Opslaan..." : "Retentie opslaan"}
          </Button>
        }
      >
        <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
          <Card.Content className="grid gap-4 md:grid-cols-2">
            <div className="field-stack">
              <label className="text-sm font-medium">Retentieritme</label>
              <NativeSelect fullWidth>
                <NativeSelect.Trigger
                  value={retentionCadence}
                  onChange={(event) =>
                    setRetentionCadence(
                      event.target.value as typeof snapshot.retentionWorkspace.retentionCadence,
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
            <div className="field-stack">
              <Label>Kanaal voor clubgroepen</Label>
              <Input
                fullWidth
                value={communityChannel}
                onChange={(event) => setCommunityChannel(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Thema voor uitdagingen</Label>
              <Input
                fullWidth
                value={challengeTheme}
                onChange={(event) => setChallengeTheme(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Aanleiding voor vragenlijst</Label>
              <Input
                fullWidth
                value={questionnaireTrigger}
                onChange={(event) => setQuestionnaireTrigger(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>PRO+ contentpad</Label>
              <Input
                fullWidth
                placeholder="https://content.jegym.nl/pro"
                value={proContentPath}
                onChange={(event) => setProContentPath(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>FitZone-aanbod</Label>
              <Input
                fullWidth
                value={fitZoneOffer}
                onChange={(event) => setFitZoneOffer(event.target.value)}
              />
            </div>
          </Card.Content>
        </Card>
      </PageSection>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {[
          {
            icon: Users,
            label: "Actieve basis",
            value: String(activeMembers),
            helper: "Deze groep voedt clubgroepen, beloningen en ledencontent.",
          },
          {
            icon: ShieldAlert,
            label: "Risico-items",
            value: String(pendingWaivers),
            helper: "Open intake of administratie is vaak het eerste retentiesignaal.",
          },
          {
            icon: Award,
            label: "Uitdagingsdruk",
            value: String(waitlistBookings),
            helper: "Wachtlijsten helpen je nieuwe activatieprogramma’s slim richten.",
          },
          {
            icon: MessageSquareHeart,
            label: "Proeflesopvolging",
            value: String(trialMembers),
            helper: "Proefleden vormen je snelste conversielijst voor opvolging.",
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
        title="Lidopvolging"
        description="Gebruik bestaande berichttekst als basis voor retentiecampagnes en updates aan clubgroepen."
      >
        <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
          <Card.Content className="space-y-3">
            <p className="text-sm font-medium">Voorbeeldbericht</p>
            <p className="text-muted text-sm leading-7">{snapshot.notificationPreview}</p>
          </Card.Content>
        </Card>
      </PageSection>

      <div className="section-stack">
        <Segment
          aria-label="Retentie formulieren"
          className="w-full max-w-3xl"
          selectedKey={retentionFormView}
          size="sm"
          onSelectionChange={(key) =>
            setRetentionFormView(String(key) as typeof retentionFormView)
          }
        >
          <Segment.Item id="community">Clubgroepen</Segment.Item>
          <Segment.Item id="questionnaires">Vragenlijsten</Segment.Item>
        </Segment>

        {retentionFormView === "community" ? (
        <PageSection
          title="Clubgroepen en uitdagingen"
          description="Maak groepen en loyaliteitscampagnes op echte leden, niet alleen op instellingen."
        >
          <div className="grid gap-4">
            <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
              <Card.Content className="grid gap-4 md:grid-cols-2">
                <div className="field-stack">
                  <Label>Groepsnaam</Label>
                  <Input fullWidth value={groupName} onChange={(event) => setGroupName(event.target.value)} />
                </div>
                <div className="field-stack">
                  <Label>Kanaal</Label>
                  <Input fullWidth value={groupChannel} onChange={(event) => setGroupChannel(event.target.value)} />
                </div>
                <div className="field-stack md:col-span-2">
                  <Label>Beschrijving</Label>
                  <Input fullWidth value={groupDescription} onChange={(event) => setGroupDescription(event.target.value)} />
                </div>
                <div className="field-stack md:col-span-2">
                  <Label>Lid-ID&apos;s (komma gescheiden)</Label>
                  <Input fullWidth value={groupMemberIds} onChange={(event) => setGroupMemberIds(event.target.value)} />
                </div>
              </Card.Content>
              <Card.Content className="pt-0">
                <Button
                  isDisabled={isPending}
                  variant="outline"
                  onPress={() =>
                    startTransition(async () => {
                      try {
                        await submitDashboardMutation("/api/platform/community", {
                          operation: "create_group",
                          name: groupName,
                          channel: groupChannel,
                          description: groupDescription,
                          memberIds: parseCommaList(groupMemberIds),
                        });
                        toast.success("Clubgroep toegevoegd.");
                        router.refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Clubgroep maken mislukt.",
                        );
                      }
                    })
                  }
                >
                  Groep toevoegen
                </Button>
              </Card.Content>
            </Card>

            <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
              <Card.Content className="grid gap-4 md:grid-cols-2">
                <div className="field-stack">
                  <Label>Uitdagingstitel</Label>
                  <Input fullWidth value={challengeTitle} onChange={(event) => setChallengeTitle(event.target.value)} />
                </div>
                <div className="field-stack">
                  <Label>Beloning</Label>
                  <Input fullWidth value={challengeRewardLabel} onChange={(event) => setChallengeRewardLabel(event.target.value)} />
                </div>
                <div className="field-stack">
                  <Label>Start</Label>
                  <Input fullWidth value={challengeStartsAt} onChange={(event) => setChallengeStartsAt(event.target.value)} />
                </div>
                <div className="field-stack">
                  <Label>Einde</Label>
                  <Input fullWidth value={challengeEndsAt} onChange={(event) => setChallengeEndsAt(event.target.value)} />
                </div>
                <div className="field-stack md:col-span-2">
                  <Label>Deelnemers (lid-ID&apos;s)</Label>
                  <Input fullWidth value={challengeMemberIds} onChange={(event) => setChallengeMemberIds(event.target.value)} />
                </div>
              </Card.Content>
              <Card.Content className="pt-0">
                <Button
                  isDisabled={isPending}
                  variant="outline"
                  onPress={() =>
                    startTransition(async () => {
                      try {
                        await submitDashboardMutation("/api/platform/community", {
                          operation: "create_challenge",
                          title: challengeTitle,
                          rewardLabel: challengeRewardLabel,
                          startsAt: challengeStartsAt,
                          endsAt: challengeEndsAt,
                          participantMemberIds: parseCommaList(challengeMemberIds),
                        });
                        toast.success("Uitdaging toegevoegd.");
                        router.refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Uitdaging maken mislukt.",
                        );
                      }
                    })
                  }
                >
                  Uitdaging toevoegen
                </Button>
              </Card.Content>
            </Card>
          </div>

          <div className="grid gap-3">
            {snapshot.communityHub.groups.map((group) => (
              <Card key={group.id} className="rounded-2xl border-border/80 bg-surface-secondary">
                <Card.Content className="space-y-2">
                  <p className="font-medium">{group.name}</p>
                  <p className="text-muted text-sm">
                    {group.channel} · {group.memberIds.length} leden
                  </p>
                  <p className="text-muted text-sm">{group.description}</p>
                </Card.Content>
              </Card>
            ))}
            {snapshot.communityHub.challenges.map((challenge) => (
              <Card key={challenge.id} className="rounded-2xl border-border/80 bg-surface-secondary">
                <Card.Content className="space-y-2">
                  <p className="font-medium">{challenge.title}</p>
                  <p className="text-muted text-sm">
                    Beloning: {challenge.rewardLabel} · {challenge.participantMemberIds.length} deelnemers
                  </p>
                  <p className="text-muted text-sm">
                    {formatDateTime(challenge.startsAt)} tot {formatDateTime(challenge.endsAt)}
                  </p>
                </Card.Content>
              </Card>
            ))}
            {snapshot.communityHub.groups.length === 0 && snapshot.communityHub.challenges.length === 0 ? (
              <EmptyPanel
                title="Nog geen retentiedata"
                description="Groepen en uitdagingen verschijnen hier zodra je de eerste clubgroep start."
              />
            ) : null}
          </div>
        </PageSection>
        ) : null}

        {retentionFormView === "questionnaires" ? (
        <PageSection
          title="Vragenlijsten"
          description="Bewaar vragenlijsten en reacties als echte dataset voor opzegsignalen en ledengevoel."
        >
          <div className="grid gap-4">
            <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
              <Card.Content className="grid gap-4">
                <div className="field-stack">
                  <Label>Titel</Label>
                  <Input fullWidth value={questionnaireTitle} onChange={(event) => setQuestionnaireTitle(event.target.value)} />
                </div>
                <div className="field-stack">
                  <Label>Aanleiding</Label>
                  <Input fullWidth value={questionnaireTrigger} onChange={(event) => setQuestionnaireTrigger(event.target.value)} />
                </div>
                <div className="field-stack">
                  <Label>Vragen (komma gescheiden)</Label>
                  <Input fullWidth value={questionnaireQuestions} onChange={(event) => setQuestionnaireQuestions(event.target.value)} />
                </div>
              </Card.Content>
              <Card.Content className="pt-0">
                <Button
                  isDisabled={isPending}
                  variant="outline"
                  onPress={() =>
                    startTransition(async () => {
                      try {
                        await submitDashboardMutation("/api/platform/community", {
                          operation: "create_questionnaire",
                          title: questionnaireTitle,
                          trigger: questionnaireTrigger,
                          questions: parseCommaList(questionnaireQuestions),
                        });
                          toast.success("Vragenlijst toegevoegd.");
                        router.refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Vragenlijst maken mislukt.",
                        );
                      }
                    })
                  }
                >
                  Vragenlijst opslaan
                </Button>
              </Card.Content>
            </Card>

            <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
              <Card.Content className="grid gap-4 md:grid-cols-2">
                <div className="field-stack">
                  <label className="text-sm font-medium">Vragenlijst</label>
                  <NativeSelect fullWidth>
                    <NativeSelect.Trigger
                      value={selectedQuestionnaireId}
                      onChange={(event) => setSelectedQuestionnaireId(event.target.value)}
                    >
                      {snapshot.communityHub.questionnaires.map((questionnaire) => (
                        <NativeSelect.Option key={questionnaire.id} value={questionnaire.id}>
                          {questionnaire.title}
                        </NativeSelect.Option>
                      ))}
                      <NativeSelect.Indicator />
                    </NativeSelect.Trigger>
                  </NativeSelect>
                </div>
                <div className="field-stack">
                  <label className="text-sm font-medium">Lid</label>
                  <NativeSelect fullWidth>
                    <NativeSelect.Trigger
                      value={responseMemberId}
                      onChange={(event) => setResponseMemberId(event.target.value)}
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
                <div className="field-stack md:col-span-2">
                  <Label>Antwoorden (komma gescheiden)</Label>
                  <Input fullWidth value={responseAnswers} onChange={(event) => setResponseAnswers(event.target.value)} />
                </div>
              </Card.Content>
              <Card.Content className="space-y-2 pt-0">
                <Button
                  isDisabled={Boolean(questionnaireResponseDisabledReason)}
                  variant="outline"
                  onPress={() =>
                    startTransition(async () => {
                      try {
                        const member = snapshot.members.find((entry) => entry.id === responseMemberId);

                        await submitDashboardMutation("/api/platform/community", {
                          operation: "submit_response",
                          questionnaireId: selectedQuestionnaireId,
                          memberId: responseMemberId,
                          memberName: member?.fullName ?? "Lid",
                          answers: parseCommaList(responseAnswers),
                        });
                        toast.success("Reactie op vragenlijst opgeslagen.");
                        router.refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Reactie opslaan mislukt.",
                        );
                      }
                    })
                  }
                >
                  Reactie toevoegen
                </Button>
                <DisabledActionReason reason={questionnaireResponseDisabledReason} />
              </Card.Content>
            </Card>

            {snapshot.communityHub.questionnaires.length > 0 ? (
              <div className="grid gap-3">
                {snapshot.communityHub.questionnaires.map((questionnaire) => (
                  <Card key={questionnaire.id} className="rounded-2xl border-border/80 bg-surface-secondary">
                    <Card.Content className="space-y-2">
                      <p className="font-medium">{questionnaire.title}</p>
                      <p className="text-muted text-sm">
                        {questionnaire.trigger} · {questionnaire.responseCount} reacties
                      </p>
                      <p className="text-muted text-sm">{questionnaire.questions.join(" · ")}</p>
                    </Card.Content>
                  </Card>
                ))}
                {snapshot.communityHub.responses.slice(0, 4).map((response) => (
                  <Card key={response.id} className="rounded-2xl border-border/80 bg-surface-secondary">
                    <Card.Content className="space-y-2">
                      <p className="font-medium">{response.memberName}</p>
                      <p className="text-muted text-sm">{response.answers.join(" · ")}</p>
                    </Card.Content>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyPanel
                title="Nog geen vragenlijsten"
                description="Vragenlijstdata verschijnt hier zodra je de eerste aanleiding live zet."
              />
            )}
          </div>
        </PageSection>
        ) : null}
      </div>

      <PageSection
        title="Retentiemodules"
        description="Compact overzicht van clubgroepen, loyaliteit en opzegpreventie."
      >
        <FeatureModuleBoard currentPage="retention" features={retentionFeatures} snapshot={snapshot} />
      </PageSection>
    </div>
  );
}
