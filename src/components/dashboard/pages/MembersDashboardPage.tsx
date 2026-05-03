"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Chip, Input, Label } from "@heroui/react";
import { Button } from "@/components/dashboard/HydrationSafeButton";
import { ListView } from "@/components/dashboard/HydrationSafeListView";
import { Segment } from "@/components/dashboard/HydrationSafeSegment";
import { toast } from "sonner";
import { DashboardEntityActions } from "@/components/DashboardEntityActions";
import { submitDashboardMutation } from "@/components/dashboard/dashboard-client-helpers";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import { LazyPlatformWorkbench } from "@/components/dashboard/LazyPlatformWorkbench";
import { filterManagementRecords } from "@/lib/dashboard-management";
import {
  getBillingPaymentMethodLabel,
  getMemberSignupStatusLabel,
  getMemberStatusLabel,
  getWaiverRecordStatusLabel,
  getWaiverStatusLabel,
} from "@/lib/ui-labels";
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
  const [memberSearch, setMemberSearch] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState("all");
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
  const filteredMembers = filterManagementRecords(snapshot.members, {
    query: memberSearch,
    searchKeys: ["fullName", "email", "phone", "tags"],
    filterKey: "status",
    filterValue: memberStatusFilter,
  });

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
      <div className="section-stack">
        <div className="section-stack">
        <PageSection title="Leden" description="Bekijk lidstatus, intake en waiverstatus.">
          <div className="grid content-start gap-3">
            <Segment
              className="w-full max-w-[22rem]"
            selectedKey={membersView}
            size="sm"
            onSelectionChange={(key) => setMembersView(String(key) as typeof membersView)}
          >
            <Segment.Item id="members">Leden</Segment.Item>
            <Segment.Item id="waivers">Waivers</Segment.Item>
          </Segment>

          {membersView === "members" ? (
            snapshot.members.length > 0 ? (
              <>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <div className="field-stack">
                  <Label>Zoeken</Label>
                  <Input
                    fullWidth
                    placeholder="Zoek op naam, e-mail, telefoon of tag"
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                  />
                </div>
                <label className="field-stack">
                  <span className="text-sm font-medium">Filter</span>
                  <select
                    className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                    value={memberStatusFilter}
                    onChange={(event) => setMemberStatusFilter(event.target.value)}
                  >
                    <option value="all">Alle statussen</option>
                    <option value="active">Actief</option>
                    <option value="trial">Proeflid</option>
                    <option value="paused">Gepauzeerd</option>
                    <option value="archived">Gearchiveerd</option>
                  </select>
                </label>
              </div>
              {filteredMembers.length > 0 ? (
              <ListView aria-label="Leden" items={filteredMembers}>
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
                          {getMemberStatusLabel(member.status)}
                        </Chip>
                        <Chip size="sm" variant="tertiary">
                          {getWaiverStatusLabel(member.waiverStatus)}
                        </Chip>
                        {snapshot.memberPortalAccessMemberIds.includes(member.id) ? (
                          <Chip size="sm" variant="soft">
                            portal
                          </Chip>
                        ) : null}
                      </div>
                      <DashboardEntityActions
                        endpoint="/api/platform/members"
                        entityLabel={`Lid ${member.fullName}`}
                        updatePayloadBase={{
                          id: member.id,
                          expectedVersion: member.version,
                        }}
                        archivePayload={{
                          id: member.id,
                          expectedVersion: member.version,
                        }}
                        deletePayload={{
                          id: member.id,
                          expectedVersion: member.version,
                        }}
                        fields={[
                          { name: "fullName", label: "Naam", defaultValue: member.fullName },
                          { name: "email", label: "E-mail", defaultValue: member.email, type: "email" },
                          { name: "phone", label: "Telefoon", defaultValue: member.phone },
                          {
                            name: "phoneCountry",
                            label: "Landcode",
                            defaultValue: member.phoneCountry,
                            type: "select",
                            options: ["NL", "BE", "DE", "GB", "US", "AE"].map((country) => ({
                              value: country,
                              label: country,
                            })),
                          },
                          {
                            name: "membershipPlanId",
                            label: "Lidmaatschap",
                            defaultValue: member.membershipPlanId,
                            type: "select",
                            options: snapshot.membershipPlans.map((plan) => ({
                              value: plan.id,
                              label: plan.name,
                            })),
                          },
                          {
                            name: "homeLocationId",
                            label: "Vestiging",
                            defaultValue: member.homeLocationId,
                            type: "select",
                            options: snapshot.locations.map((location) => ({
                              value: location.id,
                              label: location.name,
                            })),
                          },
                          {
                            name: "status",
                            label: "Status",
                            defaultValue: member.status,
                            type: "select",
                            options: [
                              { value: "active", label: "Actief" },
                              { value: "trial", label: "Proeflid" },
                              { value: "paused", label: "Gepauzeerd" },
                              { value: "archived", label: "Gearchiveerd" },
                            ],
                          },
                          {
                            name: "waiverStatus",
                            label: "Waiver",
                            defaultValue: member.waiverStatus,
                            type: "select",
                            options: [
                              { value: "complete", label: "Compleet" },
                              { value: "pending", label: "Open" },
                            ],
                          },
                          { name: "tags", label: "Tags", defaultValue: member.tags, type: "list" },
                        ]}
                      />
                    </ListView.Item>
                  );
                }}
              </ListView>
              ) : (
                <EmptyPanel
                  title="Geen leden gevonden"
                  description="Pas je zoekterm of statusfilter aan om meer leden te tonen."
                />
              )}
              </>
            ) : (
              <EmptyPanel
                title="Nog geen leden"
                description="Voeg je eerste lid toe of importeer je bestaande ledenlijst."
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
                      {getWaiverRecordStatusLabel(waiver.status)}
                    </Chip>
                  </ListView.Item>
                );
              }}
            </ListView>
          ) : (
            <EmptyPanel
              title="Nog geen waivers"
              description="Ondertekende of aangevraagde waivers verschijnen hier zodra leden zijn toegevoegd."
            />
            )}
          </div>
        </PageSection>

        <PageSection
          title="Lidaanmeldingen"
          description="Publieke inschrijvingen tonen hier contract, waiver en checkoutstatus. Alleen oude pending aanvragen vragen nog handmatige review."
        >
          {snapshot.memberSignups.length > 0 ? (
            <div className="grid gap-3">
              {snapshot.memberSignups.map((signup) => (
                <div key={signup.id} className="soft-card space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{signup.fullName}</p>
                      <p className="text-muted text-sm">
                        {signup.email} · {getBillingPaymentMethodLabel(signup.paymentMethod)}
                      </p>
                    </div>
                    <Chip size="sm" variant={signup.status === "pending_review" ? "soft" : "tertiary"}>
                      {getMemberSignupStatusLabel(signup.status)}
                    </Chip>
                  </div>
                  <div className="grid gap-1 text-sm">
                    <p className="text-muted">
                      Lidmaatschap:{" "}
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
                          <Label>Eigenaarsnotitie</Label>
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
                          <Label>Ledenportaalwachtwoord</Label>
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
              description="Publieke aanmeldingen verschijnen hier zodra prospects het aanmeldformulier gebruiken."
            />
          )}
        </PageSection>
        </div>

        <LazyPlatformWorkbench sections={["members"]} showLaunchHeader={false} snapshot={snapshot} />
      </div>

      <PageSection
        title="Ledenmodules"
        description="Compact overzicht van ledenbeheer, intake en lidmaatschapscyclus."
      >
        <FeatureModuleBoard currentPage="members" features={memberFeatures} snapshot={snapshot} />
      </PageSection>
    </div>
  );
}
