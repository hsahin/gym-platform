"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Award, MessageSquareHeart, ShieldAlert, Users } from "lucide-react";
import { Button, Card, Input, Label } from "@heroui/react";
import { NativeSelect } from "@heroui-pro/react/native-select";
import { toast } from "sonner";
import {
  parseCommaList,
  submitDashboardMutation,
} from "@/components/dashboard/dashboard-client-helpers";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import {
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
  const [groupName, setGroupName] = useState("Community starters");
  const [groupChannel, setGroupChannel] = useState("WhatsApp");
  const [groupDescription, setGroupDescription] = useState("Nieuwe leden die elkaar wekelijks motiveren.");
  const [groupMemberIds, setGroupMemberIds] = useState("");
  const [challengeTitle, setChallengeTitle] = useState("30-day consistency challenge");
  const [challengeRewardLabel, setChallengeRewardLabel] = useState("Gratis recovery shake");
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

  return (
    <div className="section-stack">
      <PageSection
        title="Retention modules"
        description="Bouw community, loyaliteit en churn-preventie bovenop je live leden- en reserveringsdata."
      >
        <FeatureModuleBoard features={retentionFeatures} snapshot={snapshot} />
      </PageSection>

      <PageSection
        title="Retention setup"
        description="Bepaal hoe communities, challenges, surveys en premium content in jouw gym moeten landen."
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
              <label className="text-sm font-medium">Retention cadence</label>
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
              <Label>Community channel</Label>
              <Input
                fullWidth
                value={communityChannel}
                onChange={(event) => setCommunityChannel(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Challenge theme</Label>
              <Input
                fullWidth
                value={challengeTheme}
                onChange={(event) => setChallengeTheme(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Questionnaire trigger</Label>
              <Input
                fullWidth
                value={questionnaireTrigger}
                onChange={(event) => setQuestionnaireTrigger(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>PRO+ content path</Label>
              <Input
                fullWidth
                placeholder="https://content.jegym.nl/pro"
                value={proContentPath}
                onChange={(event) => setProContentPath(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>FitZone offer</Label>
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
            helper: "Deze groep voedt communities, rewards en premium content.",
          },
          {
            icon: ShieldAlert,
            label: "Risico-items",
            value: String(pendingWaivers),
            helper: "Open intake of administratie is vaak het eerste retentiesignaal.",
          },
          {
            icon: Award,
            label: "Challenge druk",
            value: String(waitlistBookings),
            helper: "Wachtlijsten helpen je nieuwe engagementprogramma’s slim richten.",
          },
          {
            icon: MessageSquareHeart,
            label: "Trial follow-up",
            value: String(trialMembers),
            helper: "Trials vormen je snelste conversie- en nurturesegment.",
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
        title="Member follow-up cue"
        description="Gebruik bestaande communicatiecopy als basis voor retentiecampagnes en community-updates."
      >
        <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
          <Card.Content className="space-y-3">
            <p className="text-sm font-medium">Voorbeeldbericht</p>
            <p className="text-muted text-sm leading-7">{snapshot.notificationPreview}</p>
          </Card.Content>
        </Card>
      </PageSection>

      <div className="grid gap-4 xl:grid-cols-2">
        <PageSection
          title="Community en challenges"
          description="Maak groepen en loyaliteitscampagnes op echte members, niet alleen op instellingen."
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
                  <Label>Member IDs (komma gescheiden)</Label>
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
                        toast.success("Communitygroep toegevoegd.");
                        router.refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Communitygroep maken mislukt.",
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
                  <Label>Challenge titel</Label>
                  <Input fullWidth value={challengeTitle} onChange={(event) => setChallengeTitle(event.target.value)} />
                </div>
                <div className="field-stack">
                  <Label>Reward</Label>
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
                  <Label>Deelnemers (member IDs)</Label>
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
                        toast.success("Challenge toegevoegd.");
                        router.refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Challenge maken mislukt.",
                        );
                      }
                    })
                  }
                >
                  Challenge toevoegen
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
                    Reward: {challenge.rewardLabel} · {challenge.participantMemberIds.length} deelnemers
                  </p>
                  <p className="text-muted text-sm">
                    {formatDateTime(challenge.startsAt)} tot {formatDateTime(challenge.endsAt)}
                  </p>
                </Card.Content>
              </Card>
            ))}
            {snapshot.communityHub.groups.length === 0 && snapshot.communityHub.challenges.length === 0 ? (
              <EmptyPanel
                title="Nog geen retention datasets"
                description="Groepen en challenges verschijnen hier zodra je de eerste communityflow start."
              />
            ) : null}
          </div>
        </PageSection>

        <PageSection
          title="Questionnaires"
          description="Bewaar vragenlijsten en responses als echte dataset voor churn en member sentiment."
        >
          <div className="grid gap-4">
            <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
              <Card.Content className="grid gap-4">
                <div className="field-stack">
                  <Label>Titel</Label>
                  <Input fullWidth value={questionnaireTitle} onChange={(event) => setQuestionnaireTitle(event.target.value)} />
                </div>
                <div className="field-stack">
                  <Label>Trigger</Label>
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
                        toast.success("Questionnaire toegevoegd.");
                        router.refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Questionnaire maken mislukt.",
                        );
                      }
                    })
                  }
                >
                  Questionnaire opslaan
                </Button>
              </Card.Content>
            </Card>

            <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
              <Card.Content className="grid gap-4 md:grid-cols-2">
                <div className="field-stack">
                  <label className="text-sm font-medium">Questionnaire</label>
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
              <Card.Content className="pt-0">
                <Button
                  isDisabled={isPending || !selectedQuestionnaireId || !responseMemberId}
                  variant="outline"
                  onPress={() =>
                    startTransition(async () => {
                      try {
                        const member = snapshot.members.find((entry) => entry.id === responseMemberId);

                        await submitDashboardMutation("/api/platform/community", {
                          operation: "submit_response",
                          questionnaireId: selectedQuestionnaireId,
                          memberId: responseMemberId,
                          memberName: member?.fullName ?? "Member",
                          answers: parseCommaList(responseAnswers),
                        });
                        toast.success("Questionnaire response opgeslagen.");
                        router.refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Response opslaan mislukt.",
                        );
                      }
                    })
                  }
                >
                  Response toevoegen
                </Button>
              </Card.Content>
            </Card>

            {snapshot.communityHub.questionnaires.length > 0 ? (
              <div className="grid gap-3">
                {snapshot.communityHub.questionnaires.map((questionnaire) => (
                  <Card key={questionnaire.id} className="rounded-2xl border-border/80 bg-surface-secondary">
                    <Card.Content className="space-y-2">
                      <p className="font-medium">{questionnaire.title}</p>
                      <p className="text-muted text-sm">
                        {questionnaire.trigger} · {questionnaire.responseCount} responses
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
                title="Nog geen questionnaires"
                description="Surveydata verschijnt hier zodra je de eerste trigger live zet."
              />
            )}
          </div>
        </PageSection>
      </div>
    </div>
  );
}
