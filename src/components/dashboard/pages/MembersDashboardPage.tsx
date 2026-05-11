"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Chip, Input, Label } from "@heroui/react";
import { Button } from "@/components/dashboard/HydrationSafeButton";
import {
  DataGrid,
  type DataGridColumn,
} from "@/components/dashboard/HydrationSafeDataGrid";
import { Segment } from "@/components/dashboard/HydrationSafeSegment";
import { toast } from "sonner";
import { DashboardEntityDataGrid } from "@/components/dashboard/DashboardEntityDataGrid";
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
    Record<
      string,
      {
        ownerNotes: string;
        portalPassword: string;
        memberStatus: "active" | "trial";
      }
    >
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
  type MemberRow = (typeof snapshot.members)[number];
  type WaiverRow = (typeof snapshot.waivers)[number];
  const memberColumns: DataGridColumn<MemberRow>[] = [
    {
      id: "fullName",
      header: "Lid",
      accessorKey: "fullName",
      allowsSorting: true,
      isRowHeader: true,
      minWidth: 220,
      pinned: "start",
      cell: (member) => (
        <span className="grid min-w-0 gap-1">
          <span className="truncate font-medium">{member.fullName}</span>
          <span className="text-muted truncate text-xs">
            {member.email} · {formatDate(member.joinedAt)}
          </span>
        </span>
      ),
    },
    {
      id: "membershipPlanId",
      header: "Lidmaatschap",
      accessorKey: "membershipPlanId",
      allowsSorting: true,
      minWidth: 160,
      cell: (member) => membershipPlansById.get(member.membershipPlanId) ?? member.membershipPlanId,
    },
    {
      id: "homeLocationId",
      header: "Vestiging",
      accessorKey: "homeLocationId",
      allowsSorting: true,
      minWidth: 150,
      cell: (member) => locationsById.get(member.homeLocationId) ?? member.homeLocationId,
    },
    {
      id: "phone",
      header: "Telefoon",
      accessorKey: "phone",
      minWidth: 140,
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      allowsSorting: true,
      minWidth: 120,
      cell: (member) => {
        const chip = statusChip(member.status);

        return (
          <Chip color={chip.color} size="sm" variant={chip.variant}>
            {getMemberStatusLabel(member.status)}
          </Chip>
        );
      },
    },
    {
      id: "waiverStatus",
      header: "Waiver",
      accessorKey: "waiverStatus",
      allowsSorting: true,
      minWidth: 130,
      cell: (member) => (
        <Chip size="sm" variant="tertiary">
          {getWaiverStatusLabel(member.waiverStatus)}
        </Chip>
      ),
    },
    {
      id: "portal",
      header: "Portaal",
      minWidth: 110,
      cell: (member) =>
        snapshot.memberPortalAccessMemberIds.includes(member.id) ? (
          <Chip size="sm" variant="soft">
            Actief
          </Chip>
        ) : (
          <span className="text-muted text-sm">Niet actief</span>
        ),
    },
    {
      id: "tags",
      header: "Tags",
      minWidth: 180,
      cell: (member) => (
        <span className="text-muted line-clamp-1 text-sm">
          {member.tags.length > 0 ? member.tags.join(", ") : "Geen tags"}
        </span>
      ),
    },
  ];
  const waiverColumns: DataGridColumn<WaiverRow>[] = [
    {
      id: "memberName",
      header: "Lid",
      accessorKey: "memberName",
      allowsSorting: true,
      isRowHeader: true,
      minWidth: 220,
      pinned: "start",
    },
    {
      id: "fileName",
      header: "Document",
      minWidth: 220,
      cell: (waiver) => waiver.fileName ?? "Nog geen document",
    },
    {
      id: "expiresAt",
      header: "Verloopt",
      minWidth: 150,
      cell: (waiver) => (waiver.expiresAt ? formatDate(waiver.expiresAt) : "Geen verloopdatum"),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      allowsSorting: true,
      minWidth: 130,
      cell: (waiver) => {
        const chip = statusChip(waiver.status);

        return (
          <Chip color={chip.color} size="sm" variant={chip.variant}>
            {getWaiverRecordStatusLabel(waiver.status)}
          </Chip>
        );
      },
    },
  ];

  function updateSignupDraft(signupId: string, patch: Partial<(typeof signupDrafts)[string]>) {
    setSignupDrafts((current) => ({
      ...current,
      [signupId]: {
        ownerNotes: current[signupId]?.ownerNotes ?? "",
        portalPassword: current[signupId]?.portalPassword ?? "",
        memberStatus: current[signupId]?.memberStatus ?? "active",
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
              <DashboardEntityDataGrid
                ariaLabel="Leden"
                columns={memberColumns}
                contentClassName="min-w-[1180px]"
                data={filteredMembers}
                defaultSortDescriptor={{ column: "fullName", direction: "ascending" }}
                getRowId={(member) => member.id}
                getActionsProps={(member) => ({
                  endpoint: "/api/platform/members",
                  entityLabel: `Lid ${member.fullName}`,
                  updatePayloadBase: {
                    id: member.id,
                    expectedVersion: member.version,
                  },
                  archivePayload: {
                    id: member.id,
                    expectedVersion: member.version,
                  },
                  deletePayload: {
                    id: member.id,
                    expectedVersion: member.version,
                  },
                  fields: [
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
                  ],
                })}
              />
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
            <DataGrid
              allowsColumnResize
              aria-label="Waivers"
              columns={waiverColumns}
              contentClassName="min-w-[720px]"
              data={[...snapshot.waivers]}
              defaultSortDescriptor={{ column: "memberName", direction: "ascending" }}
              getRowId={(waiver) => waiver.memberId}
            />
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
                      <div className="field-stack">
                        <Label>Lidstatus na goedkeuren</Label>
                        <Segment
                          aria-label="Lidstatus"
                          className="w-fit"
                          selectedKey={signupDrafts[signup.id]?.memberStatus ?? "active"}
                          size="sm"
                          onSelectionChange={(key) =>
                            updateSignupDraft(signup.id, {
                              memberStatus: String(key) as "active" | "trial",
                            })
                          }
                        >
                          <Segment.Item id="active">Actief lid</Segment.Item>
                          <Segment.Item id="trial">Proeflid</Segment.Item>
                        </Segment>
                        <p className="text-muted text-xs">
                          Actief = volwaardig lid. Proeflid = trialperiode voordat het lidmaatschap definitief wordt.
                        </p>
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
                                  memberStatus:
                                    signupDrafts[signup.id]?.memberStatus ?? "active",
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
