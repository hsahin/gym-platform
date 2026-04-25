"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, HeartPulse, PlayCircle, Target } from "lucide-react";
import { Button, Card, Input, Label } from "@heroui/react";
import { ListView } from "@heroui-pro/react/list-view";
import { NativeSelect } from "@heroui-pro/react/native-select";
import { toast } from "sonner";
import { submitDashboardMutation } from "@/components/dashboard/dashboard-client-helpers";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import {
  EmptyPanel,
  PageSection,
  formatDateTime,
  type DashboardPageProps,
} from "@/components/dashboard/shared";

export function CoachingDashboardPage({ snapshot }: DashboardPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const coachingFeatures = snapshot.featureFlags.filter(
    (feature) => feature.dashboardPage === "coaching",
  );
  const [workoutPlanFocus, setWorkoutPlanFocus] = useState(
    snapshot.coachingWorkspace.workoutPlanFocus,
  );
  const [nutritionCadence, setNutritionCadence] = useState(
    snapshot.coachingWorkspace.nutritionCadence,
  );
  const [videoLibraryUrl, setVideoLibraryUrl] = useState(
    snapshot.coachingWorkspace.videoLibraryUrl,
  );
  const [progressMetric, setProgressMetric] = useState(
    snapshot.coachingWorkspace.progressMetric,
  );
  const [heartRateProvider, setHeartRateProvider] = useState(
    snapshot.coachingWorkspace.heartRateProvider,
  );
  const [aiCoachMode, setAiCoachMode] = useState(snapshot.coachingWorkspace.aiCoachMode);
  const [packMemberId, setPackMemberId] = useState(snapshot.members[0]?.id ?? "");
  const [packMemberName, setPackMemberName] = useState(snapshot.members[0]?.fullName ?? "");
  const [packTrainerId, setPackTrainerId] = useState(snapshot.trainers[0]?.id ?? "");
  const [packTitle, setPackTitle] = useState("PT pack 10 credits");
  const [packCredits, setPackCredits] = useState(10);
  const [packValidUntil, setPackValidUntil] = useState("2026-12-31T00:00:00.000Z");
  const [sessionTrainerId, setSessionTrainerId] = useState(snapshot.trainers[0]?.id ?? "");
  const [sessionMemberId, setSessionMemberId] = useState(snapshot.members[0]?.id ?? "");
  const [sessionLocationId, setSessionLocationId] = useState(snapshot.locations[0]?.id ?? "");
  const [sessionStartsAt, setSessionStartsAt] = useState("2026-05-04T09:00:00.000Z");
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(60);
  const [sessionRecurrence, setSessionRecurrence] = useState<"none" | "weekly">("weekly");
  const [sessionOccurrences, setSessionOccurrences] = useState(4);
  const [sessionCreditPackId, setSessionCreditPackId] = useState(
    snapshot.appointments.creditPacks[0]?.id ?? "",
  );
  const [sessionNotes, setSessionNotes] = useState("PT focus: strength cycle and accountability");
  const upcomingCoachSessions = [...snapshot.classSessions]
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
    .slice(0, 5);
  const activeTrainers = snapshot.trainers.filter((trainer) => trainer.status === "active").length;
  const portalMembers = snapshot.memberPortalAccessMemberIds.length;
  const pendingWaivers = snapshot.members.filter((member) => member.waiverStatus === "pending").length;
  const liveVideoModules = coachingFeatures.filter(
    (feature) => feature.enabled && feature.key === "coaching.on_demand_videos",
  ).length;

  useEffect(() => {
    setWorkoutPlanFocus(snapshot.coachingWorkspace.workoutPlanFocus);
    setNutritionCadence(snapshot.coachingWorkspace.nutritionCadence);
    setVideoLibraryUrl(snapshot.coachingWorkspace.videoLibraryUrl);
    setProgressMetric(snapshot.coachingWorkspace.progressMetric);
    setHeartRateProvider(snapshot.coachingWorkspace.heartRateProvider);
    setAiCoachMode(snapshot.coachingWorkspace.aiCoachMode);
    setPackMemberId(snapshot.members[0]?.id ?? "");
    setPackMemberName(snapshot.members[0]?.fullName ?? "");
    setPackTrainerId(snapshot.trainers[0]?.id ?? "");
    setSessionTrainerId(snapshot.trainers[0]?.id ?? "");
    setSessionMemberId(snapshot.members[0]?.id ?? "");
    setSessionLocationId(snapshot.locations[0]?.id ?? "");
    setSessionCreditPackId(snapshot.appointments.creditPacks[0]?.id ?? "");
  }, [snapshot.appointments.creditPacks, snapshot.coachingWorkspace, snapshot.locations, snapshot.members, snapshot.trainers]);

  const trainerNamesById = new Map(snapshot.trainers.map((trainer) => [trainer.id, trainer.fullName]));
  const locationNamesById = new Map(snapshot.locations.map((location) => [location.id, location.name]));

  return (
    <div className="section-stack">
      <PageSection
        title="Coaching modules"
        description="Trainings-, voeding- en progressiemodules die je coachingpropositie verbreden."
      >
        <FeatureModuleBoard features={coachingFeatures} snapshot={snapshot} />
      </PageSection>

      <PageSection
        title="Coaching setup"
        description="Leg de vaste coachaanpak, contentbron en AI-coachstijl vast voor alle trainers."
        actions={
          <Button
            isDisabled={isPending}
            variant="outline"
            onPress={() =>
              startTransition(async () => {
                try {
                  await submitDashboardMutation("/api/platform/coaching-settings", {
                    workoutPlanFocus,
                    nutritionCadence,
                    videoLibraryUrl,
                    progressMetric,
                    heartRateProvider,
                    aiCoachMode,
                  });
                  toast.success("Coachinginstellingen opgeslagen.");
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Coachinginstellingen opslaan mislukt.",
                  );
                }
              })
            }
          >
            {isPending ? "Opslaan..." : "Coaching opslaan"}
          </Button>
        }
      >
        <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
          <Card.Content className="grid gap-4 md:grid-cols-2">
            <div className="field-stack">
              <Label>Workout focus</Label>
              <Input
                fullWidth
                value={workoutPlanFocus}
                onChange={(event) => setWorkoutPlanFocus(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <label className="text-sm font-medium">Nutrition cadence</label>
              <NativeSelect fullWidth>
                <NativeSelect.Trigger
                  value={nutritionCadence}
                  onChange={(event) =>
                    setNutritionCadence(
                      event.target.value as typeof snapshot.coachingWorkspace.nutritionCadence,
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
              <Label>Video library URL</Label>
              <Input
                fullWidth
                placeholder="https://video.jegym.nl/library"
                value={videoLibraryUrl}
                onChange={(event) => setVideoLibraryUrl(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Progress metric</Label>
              <Input
                fullWidth
                value={progressMetric}
                onChange={(event) => setProgressMetric(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Heart rate provider</Label>
              <Input
                fullWidth
                value={heartRateProvider}
                onChange={(event) => setHeartRateProvider(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>AI coach mode</Label>
              <Input
                fullWidth
                value={aiCoachMode}
                onChange={(event) => setAiCoachMode(event.target.value)}
              />
            </div>
          </Card.Content>
        </Card>
      </PageSection>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {[
          {
            icon: Target,
            label: "Actieve coaches",
            value: String(activeTrainers),
            helper: "Beschikbaar voor planbouw, reviews en 1-op-1 begeleiding.",
          },
          {
            icon: HeartPulse,
            label: "Progress klaar",
            value: String(portalMembers),
            helper: "Leden met portal-toegang zijn direct klaar voor digitale coaching.",
          },
          {
            icon: Activity,
            label: "Open intake",
            value: String(pendingWaivers),
            helper: "Openstaande intake of waiver maakt coachingopvolging extra relevant.",
          },
          {
            icon: PlayCircle,
            label: "Video aanbod",
            value: liveVideoModules > 0 ? "Live" : "Uit",
            helper: "On-demand content staat klaar zodra je deze module inschakelt.",
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
        title="Coach moments"
        description="Gebruik je bestaande rooster als anker voor workout, voeding en progressieflows."
      >
        {upcomingCoachSessions.length > 0 ? (
          <ListView aria-label="Coach moments" items={upcomingCoachSessions}>
            {(session) => (
              <ListView.Item id={session.id} textValue={session.title}>
                <ListView.ItemContent>
                  <ListView.Title>{session.title}</ListView.Title>
                  <ListView.Description>
                    {formatDateTime(session.startsAt)} · {session.focus} · {session.bookedCount}/
                    {session.capacity}
                  </ListView.Description>
                </ListView.ItemContent>
                <p className="text-muted text-xs">{session.level}</p>
              </ListView.Item>
            )}
          </ListView>
        ) : (
          <EmptyPanel
            title="Nog geen coachmomenten"
            description="Plan eerst lessen of PT-momenten zodat coachingmodules op echte sessies kunnen landen."
          />
        )}
      </PageSection>

      <div className="grid gap-4 xl:grid-cols-2">
        <PageSection
          title="PT packs"
          description="Verkoop packs en koppel resterende credits direct aan coachtrajecten."
          actions={
            <Button
              isDisabled={isPending || !packMemberId || !packTrainerId}
              variant="outline"
              onPress={() =>
                startTransition(async () => {
                  try {
                    await submitDashboardMutation("/api/platform/appointments", {
                      operation: "create_pack",
                      memberId: packMemberId,
                      memberName: packMemberName,
                      trainerId: packTrainerId,
                      title: packTitle,
                      totalCredits: packCredits,
                      validUntil: packValidUntil,
                    });
                    toast.success("PT pack toegevoegd.");
                    router.refresh();
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "PT pack toevoegen mislukt.",
                    );
                  }
                })
              }
            >
              {isPending ? "Opslaan..." : "Pack toevoegen"}
            </Button>
          }
        >
          <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
            <Card.Content className="grid gap-4 md:grid-cols-2">
              <div className="field-stack">
                <label className="text-sm font-medium">Lid</label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    value={packMemberId}
                    onChange={(event) => {
                      setPackMemberId(event.target.value);
                      const member = snapshot.members.find((entry) => entry.id === event.target.value);
                      setPackMemberName(member?.fullName ?? "");
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
                <label className="text-sm font-medium">Coach</label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    value={packTrainerId}
                    onChange={(event) => setPackTrainerId(event.target.value)}
                  >
                    {snapshot.trainers.map((trainer) => (
                      <NativeSelect.Option key={trainer.id} value={trainer.id}>
                        {trainer.fullName}
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <div className="field-stack">
                <Label>Titel</Label>
                <Input fullWidth value={packTitle} onChange={(event) => setPackTitle(event.target.value)} />
              </div>
              <div className="field-stack">
                <Label>Credits</Label>
                <Input
                  fullWidth
                  min={1}
                  type="number"
                  value={String(packCredits)}
                  onChange={(event) => setPackCredits(Number(event.target.value || "0"))}
                />
              </div>
              <div className="field-stack md:col-span-2">
                <Label>Geldig tot</Label>
                <Input fullWidth value={packValidUntil} onChange={(event) => setPackValidUntil(event.target.value)} />
              </div>
            </Card.Content>
          </Card>

          {snapshot.appointments.creditPacks.length > 0 ? (
            <div className="grid gap-3">
              {snapshot.appointments.creditPacks.map((pack) => (
                <Card key={pack.id} className="rounded-2xl border-border/80 bg-surface-secondary">
                  <Card.Content className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{pack.title}</p>
                      <p className="text-sm font-medium">
                        {pack.remainingCredits}/{pack.totalCredits} credits
                      </p>
                    </div>
                    <p className="text-muted text-sm">
                      {pack.memberName} · {trainerNamesById.get(pack.trainerId) ?? pack.trainerId}
                    </p>
                    <p className="text-muted text-sm">Geldig tot {formatDateTime(pack.validUntil)}</p>
                  </Card.Content>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyPanel
              title="Nog geen PT packs"
              description="Nieuwe credit packs verschijnen hier zodra je de eerste verkoopt."
            />
          )}
        </PageSection>

        <PageSection
          title="Coach agenda"
          description="Plan terugkerende PT-sessies, koppel packs en houd de coachagenda centraal."
          actions={
            <Button
              isDisabled={isPending || !sessionTrainerId || !sessionLocationId}
              variant="outline"
              onPress={() =>
                startTransition(async () => {
                  try {
                    const member = snapshot.members.find((entry) => entry.id === sessionMemberId);

                    await submitDashboardMutation("/api/platform/appointments", {
                      operation: "create_sessions",
                      trainerId: sessionTrainerId,
                      memberId: sessionMemberId || undefined,
                      memberName: member?.fullName,
                      locationId: sessionLocationId,
                      startsAt: sessionStartsAt,
                      durationMinutes: sessionDurationMinutes,
                      recurrence: sessionRecurrence,
                      occurrences: sessionOccurrences,
                      creditPackId: sessionCreditPackId || undefined,
                      notes: sessionNotes || undefined,
                    });
                    toast.success("Coachsessies ingepland.");
                    router.refresh();
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Coachsessies plannen mislukt.",
                    );
                  }
                })
              }
            >
              {isPending ? "Plannen..." : "Sessies plannen"}
            </Button>
          }
        >
          <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
            <Card.Content className="grid gap-4 md:grid-cols-2">
              <div className="field-stack">
                <label className="text-sm font-medium">Coach</label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    value={sessionTrainerId}
                    onChange={(event) => setSessionTrainerId(event.target.value)}
                  >
                    {snapshot.trainers.map((trainer) => (
                      <NativeSelect.Option key={trainer.id} value={trainer.id}>
                        {trainer.fullName}
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
                    value={sessionMemberId}
                    onChange={(event) => setSessionMemberId(event.target.value)}
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
                <label className="text-sm font-medium">Vestiging</label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    value={sessionLocationId}
                    onChange={(event) => setSessionLocationId(event.target.value)}
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
                <Label>Start</Label>
                <Input fullWidth value={sessionStartsAt} onChange={(event) => setSessionStartsAt(event.target.value)} />
              </div>
              <div className="field-stack">
                <Label>Duur (min)</Label>
                <Input
                  fullWidth
                  min={15}
                  step={15}
                  type="number"
                  value={String(sessionDurationMinutes)}
                  onChange={(event) => setSessionDurationMinutes(Number(event.target.value || "0"))}
                />
              </div>
              <div className="field-stack">
                <label className="text-sm font-medium">Herhaling</label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    value={sessionRecurrence}
                    onChange={(event) =>
                      setSessionRecurrence(event.target.value as typeof sessionRecurrence)
                    }
                  >
                    <NativeSelect.Option value="none">Eenmalig</NativeSelect.Option>
                    <NativeSelect.Option value="weekly">Wekelijks</NativeSelect.Option>
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <div className="field-stack">
                <Label>Aantal sessies</Label>
                <Input
                  fullWidth
                  min={1}
                  max={12}
                  type="number"
                  value={String(sessionOccurrences)}
                  onChange={(event) => setSessionOccurrences(Number(event.target.value || "0"))}
                />
              </div>
              <div className="field-stack">
                <label className="text-sm font-medium">Credit pack</label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    value={sessionCreditPackId}
                    onChange={(event) => setSessionCreditPackId(event.target.value)}
                  >
                    <NativeSelect.Option value="">Geen pack</NativeSelect.Option>
                    {snapshot.appointments.creditPacks.map((pack) => (
                      <NativeSelect.Option key={pack.id} value={pack.id}>
                        {pack.title} · {pack.remainingCredits} credits
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <div className="field-stack md:col-span-2">
                <Label>Notities</Label>
                <Input fullWidth value={sessionNotes} onChange={(event) => setSessionNotes(event.target.value)} />
              </div>
            </Card.Content>
          </Card>

          {snapshot.appointments.sessions.length > 0 ? (
            <ListView aria-label="Coach appointments" items={snapshot.appointments.sessions}>
              {(session) => (
                <ListView.Item id={session.id} textValue={session.memberName ?? session.id}>
                  <ListView.ItemContent>
                    <ListView.Title>
                      {session.memberName ?? "Vrij blok"} · {session.trainerName}
                    </ListView.Title>
                    <ListView.Description>
                      {formatDateTime(session.startsAt)} ·{" "}
                      {locationNamesById.get(session.locationId) ?? session.locationId} ·{" "}
                      {session.durationMinutes} min
                    </ListView.Description>
                  </ListView.ItemContent>
                  <p className="text-muted text-xs">
                    {session.recurrence === "weekly" ? "Wekelijkse serie" : "Eenmalig"}
                  </p>
                </ListView.Item>
              )}
            </ListView>
          ) : (
            <EmptyPanel
              title="Nog geen PT-sessies"
              description="Nieuwe coachafspraken verschijnen hier zodra je de agenda vult."
            />
          )}
        </PageSection>
      </div>
    </div>
  );
}
