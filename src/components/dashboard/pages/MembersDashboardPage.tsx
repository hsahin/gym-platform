"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, Input, Label } from "@heroui/react";
import { ListView } from "@heroui-pro/react/list-view";
import { Segment } from "@heroui-pro/react/segment";
import { toast } from "sonner";
import { submitDashboardMutation } from "@/components/dashboard/dashboard-client-helpers";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import { LazyPlatformWorkbench } from "@/components/dashboard/LazyPlatformWorkbench";
import {
  EmptyPanel,
  PageSection,
  formatDate,
  statusChip,
  type DashboardPageProps,
} from "@/components/dashboard/shared";

export function MembersDashboardPage({ snapshot }: DashboardPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [membersView, setMembersView] = useState<"members" | "waivers">("members");
  const [signupDrafts, setSignupDrafts] = useState<
    Record<string, { ownerNotes: string; portalPassword: string }>
  >({});
  const memberFeatures = snapshot.featureFlags.filter(
    (feature) => feature.dashboardPage === "members",
  );
  const membershipPlansById = new Map(
    snapshot.membershipPlans.map((membershipPlan) => [membershipPlan.id, membershipPlan.name]),
  );
  const locationsById = new Map(
    snapshot.locations.map((location) => [location.id, location.name]),
  );

  function updateSignupDraft(signupId: string, patch: Partial<(typeof signupDrafts)[string]>) {
    setSignupDrafts((current) => ({
      ...current,
      [signupId]: {
        ownerNotes: current[signupId]?.ownerNotes ?? "",
        portalPassword: current[signupId]?.portalPassword ?? "",
        ...patch,
      },
    }));
  }

  return (
    <div className="section-stack">
      <PageSection
        title="Member operations"
        description="Ledenbeheer, intake en membership lifecycle blijven zichtbaar als afzonderlijke modules."
      >
        <FeatureModuleBoard features={memberFeatures} snapshot={snapshot} />
      </PageSection>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
        <div className="section-stack">
        <PageSection title="Members" description="Review member state and waiver completion.">
          <div className="grid content-start gap-3">
            <Segment
              className="w-full max-w-[22rem]"
            selectedKey={membersView}
            size="sm"
            onSelectionChange={(key) => setMembersView(String(key) as typeof membersView)}
          >
            <Segment.Item id="members">Members</Segment.Item>
            <Segment.Item id="waivers">Waivers</Segment.Item>
          </Segment>

          {membersView === "members" ? (
            snapshot.members.length > 0 ? (
              <ListView aria-label="Members" items={snapshot.members}>
                {(member) => {
                  const chip = statusChip(member.status);

                  return (
                    <ListView.Item id={member.id} textValue={member.fullName}>
                      <ListView.ItemContent>
                        <ListView.Title>{member.fullName}</ListView.Title>
                        <ListView.Description>
                          {member.email} · {formatDate(member.joinedAt)}
                        </ListView.Description>
                      </ListView.ItemContent>
                      <div className="flex flex-wrap gap-2">
                        <Chip color={chip.color} size="sm" variant={chip.variant}>
                          {member.status}
                        </Chip>
                        <Chip size="sm" variant="tertiary">
                          {member.waiverStatus}
                        </Chip>
                        {snapshot.memberPortalAccessMemberIds.includes(member.id) ? (
                          <Chip size="sm" variant="soft">
                            portal
                          </Chip>
                        ) : null}
                      </div>
                    </ListView.Item>
                  );
                }}
              </ListView>
            ) : (
              <EmptyPanel
                title="No members yet"
                description="Add the first member or import your existing member list."
              />
            )
          ) : snapshot.waivers.length > 0 ? (
            <ListView aria-label="Waivers" items={snapshot.waivers}>
              {(waiver) => {
                const chip = statusChip(waiver.status);

                return (
                  <ListView.Item id={waiver.memberId} textValue={waiver.memberName}>
                    <ListView.ItemContent>
                      <ListView.Title>{waiver.memberName}</ListView.Title>
                      <ListView.Description>
                        {waiver.fileName ?? "Nog geen document"} ·{" "}
                        {waiver.expiresAt ? formatDate(waiver.expiresAt) : "Geen verloopdatum"}
                      </ListView.Description>
                    </ListView.ItemContent>
                    <Chip color={chip.color} size="sm" variant={chip.variant}>
                      {waiver.status}
                    </Chip>
                  </ListView.Item>
                );
              }}
            </ListView>
          ) : (
            <EmptyPanel
              title="No waivers tracked"
              description="Signed or requested waivers appear here once members are added."
            />
            )}
          </div>
        </PageSection>

        <PageSection
          title="Member signups"
          description="Publieke aanmeldingen wachten hier op owner-goedkeuring of afwijzing."
        >
          {snapshot.memberSignups.length > 0 ? (
            <div className="grid gap-3">
              {snapshot.memberSignups.map((signup) => (
                <div key={signup.id} className="soft-card space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{signup.fullName}</p>
                      <p className="text-muted text-sm">
                        {signup.email} · {signup.paymentMethod}
                      </p>
                    </div>
                    <Chip size="sm" variant={signup.status === "pending_review" ? "soft" : "tertiary"}>
                      {signup.status}
                    </Chip>
                  </div>
                  <div className="grid gap-1 text-sm">
                    <p className="text-muted">
                      Contract:{" "}
                      {membershipPlansById.get(signup.membershipPlanId) ?? signup.membershipPlanId}
                    </p>
                    <p className="text-muted">
                      Vestiging:{" "}
                      {locationsById.get(signup.preferredLocationId) ?? signup.preferredLocationId}
                    </p>
                    <p className="text-muted">
                      Waiver {signup.waiverAcceptedAt ? "bevestigd" : "nog open"} · Contract{" "}
                      {signup.contractAcceptedAt ? "geaccepteerd" : "nog open"}
                    </p>
                    <p className="text-muted text-sm">
                      {signup.notes ?? "Geen extra notitie."}
                    </p>
                  </div>
                  {signup.status === "pending_review" ? (
                    <div className="grid gap-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="field-stack">
                          <Label>Owner notitie</Label>
                          <Input
                            fullWidth
                            placeholder="Bijv. intake inplannen na eerste check-in"
                            value={signupDrafts[signup.id]?.ownerNotes ?? ""}
                            onChange={(event) =>
                              updateSignupDraft(signup.id, {
                                ownerNotes: event.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="field-stack">
                          <Label>Portal wachtwoord</Label>
                          <Input
                            fullWidth
                            placeholder="minimaal 8 tekens"
                            type="password"
                            value={signupDrafts[signup.id]?.portalPassword ?? ""}
                            onChange={(event) =>
                              updateSignupDraft(signup.id, {
                                portalPassword: event.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                      <Button
                        isDisabled={isPending}
                        size="sm"
                        variant="outline"
                        onPress={() =>
                          startTransition(async () => {
                            try {
                              await submitDashboardMutation(
                                "/api/platform/member-signups",
                                {
                                  signupRequestId: signup.id,
                                  decision: "approved",
                                  memberStatus: "trial",
                                  ownerNotes:
                                    signupDrafts[signup.id]?.ownerNotes || undefined,
                                  portalPassword:
                                    signupDrafts[signup.id]?.portalPassword || undefined,
                                },
                                { method: "PATCH" },
                              );
                              toast.success("Aanmelding goedgekeurd.");
                              router.refresh();
                            } catch (error) {
                              toast.error(
                                error instanceof Error ? error.message : "Goedkeuren mislukt.",
                              );
                            }
                          })
                        }
                      >
                        Goedkeuren
                      </Button>
                      <Button
                        isDisabled={isPending}
                        size="sm"
                        variant="ghost"
                        onPress={() =>
                          startTransition(async () => {
                            try {
                              await submitDashboardMutation(
                                "/api/platform/member-signups",
                                {
                                  signupRequestId: signup.id,
                                  decision: "rejected",
                                  memberStatus: "trial",
                                  ownerNotes:
                                    signupDrafts[signup.id]?.ownerNotes || undefined,
                                },
                                { method: "PATCH" },
                              );
                              toast.success("Aanmelding afgewezen.");
                              router.refresh();
                            } catch (error) {
                              toast.error(
                                error instanceof Error ? error.message : "Afwijzen mislukt.",
                              );
                            }
                          })
                        }
                      >
                        Afwijzen
                      </Button>
                    </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel
              title="Nog geen self-signups"
              description="Publieke aanmeldingen verschijnen hier zodra prospects het join-formulier gebruiken."
            />
          )}
        </PageSection>
        </div>

        <LazyPlatformWorkbench sections={["members"]} showLaunchHeader={false} snapshot={snapshot} />
      </div>
    </div>
  );
}
