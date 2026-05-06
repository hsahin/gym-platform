"use client";

import Link from "next/link";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Card, Chip, Input, Label } from "@heroui/react";
import { Segment } from "@/components/dashboard/HydrationSafeSegment";
import { DashboardEntityDataGrid } from "@/components/dashboard/DashboardEntityDataGrid";
import { type DataGridColumn } from "@/components/dashboard/HydrationSafeDataGrid";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import { LazyPlatformWorkbench } from "@/components/dashboard/LazyPlatformWorkbench";
import { EmptyPanel, PageSection, type DashboardPageProps } from "@/components/dashboard/shared";
import { filterManagementRecords } from "@/lib/dashboard-management";
import {
  getEntityStatusLabel,
  getRoleLabel,
  getTrainerStatusLabel,
} from "@/lib/ui-labels";

export function SettingsDashboardPage({ snapshot }: DashboardPageProps) {
  const [settingsView, setSettingsView] = useState<"ops" | "team" | "legal">("ops");
  const [settingsSearch, setSettingsSearch] = useState("");
  const [settingsStatusFilter, setSettingsStatusFilter] = useState("all");
  const settingsFeatures = snapshot.featureFlags.filter(
    (feature) => feature.dashboardPage === "settings",
  );
  const filteredLocations = filterManagementRecords(snapshot.locations, {
    query: settingsSearch,
    searchKeys: ["name", "city", "neighborhood", "managerName", "amenities"],
    filterKey: "status",
    filterValue: settingsStatusFilter,
  });
  const filteredTrainers = filterManagementRecords(snapshot.trainers, {
    query: settingsSearch,
    searchKeys: ["fullName", "specialties", "certifications", "status"],
    filterKey: "status",
    filterValue: settingsStatusFilter,
  });
  const filteredStaff = filterManagementRecords(snapshot.staff, {
    query: settingsSearch,
    searchKeys: ["displayName", "email", "roles", "roleKey"],
    filterKey: "status",
    filterValue: settingsStatusFilter,
  });
  type LocationRow = (typeof snapshot.locations)[number];
  type TrainerRow = (typeof snapshot.trainers)[number];
  type StaffRow = (typeof snapshot.staff)[number];
  const locationColumns: DataGridColumn<LocationRow>[] = [
    {
      id: "name",
      header: "Vestiging",
      accessorKey: "name",
      allowsSorting: true,
      isRowHeader: true,
      minWidth: 220,
      pinned: "start",
      cell: (location) => (
        <span className="grid min-w-0 gap-1">
          <span className="truncate font-medium">{location.name}</span>
          <span className="text-muted truncate text-xs">
            {location.city} · {location.neighborhood}
          </span>
        </span>
      ),
    },
    {
      id: "managerName",
      header: "Manager",
      accessorKey: "managerName",
      allowsSorting: true,
      minWidth: 170,
    },
    {
      id: "capacity",
      header: "Capaciteit",
      accessorKey: "capacity",
      align: "end",
      allowsSorting: true,
      minWidth: 120,
      cell: (location) => <span className="tabular-nums">{location.capacity}</span>,
    },
    {
      id: "amenities",
      header: "Voorzieningen",
      minWidth: 220,
      cell: (location) => (
        <span className="text-muted line-clamp-1 text-sm">
          {location.amenities.length > 0 ? location.amenities.join(", ") : "Geen voorzieningen"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      allowsSorting: true,
      minWidth: 130,
      cell: (location) => (
        <Chip size="sm" variant="tertiary">
          {getEntityStatusLabel(location.status)}
        </Chip>
      ),
    },
  ];
  const trainerColumns: DataGridColumn<TrainerRow>[] = [
    {
      id: "fullName",
      header: "Trainer",
      accessorKey: "fullName",
      allowsSorting: true,
      isRowHeader: true,
      minWidth: 220,
      pinned: "start",
    },
    {
      id: "homeLocationId",
      header: "Vestiging",
      accessorKey: "homeLocationId",
      allowsSorting: true,
      minWidth: 170,
      cell: (trainer) =>
        snapshot.locations.find((location) => location.id === trainer.homeLocationId)?.name ??
        "Onbekende vestiging",
    },
    {
      id: "specialties",
      header: "Specialisaties",
      minWidth: 230,
      cell: (trainer) => (
        <span className="text-muted line-clamp-1 text-sm">
          {[...trainer.specialties, ...trainer.certifications].join(", ") || "Geen specialisaties"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      allowsSorting: true,
      minWidth: 130,
      cell: (trainer) => (
        <Chip size="sm" variant="tertiary">
          {getTrainerStatusLabel(trainer.status)}
        </Chip>
      ),
    },
  ];
  const staffColumns: DataGridColumn<StaffRow>[] = [
    {
      id: "displayName",
      header: "Medewerker",
      accessorKey: "displayName",
      allowsSorting: true,
      isRowHeader: true,
      minWidth: 220,
      pinned: "start",
      cell: (member) => (
        <span className="grid min-w-0 gap-1">
          <span className="truncate font-medium">{member.displayName}</span>
          <span className="text-muted truncate text-xs">{member.email}</span>
        </span>
      ),
    },
    {
      id: "roleKey",
      header: "Rol",
      accessorKey: "roleKey",
      allowsSorting: true,
      minWidth: 160,
      cell: (member) => member.roles.map(getRoleLabel).join(", "),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      allowsSorting: true,
      minWidth: 130,
      cell: (member) => (
        <Chip size="sm" variant="tertiary">
          {getEntityStatusLabel(member.status)}
        </Chip>
      ),
    },
  ];

  return (
    <div className="section-stack">
      <PageSection
        title="Gym instellingen"
        description="Vestigingen, medewerkers, juridische inrichting en systeemstatus."
      >
        <div className="grid content-start gap-3">
            <Segment
              className="w-full max-w-[28rem]"
              selectedKey={settingsView}
              size="sm"
              onSelectionChange={(key) => {
                setSettingsView(String(key) as typeof settingsView);
                setSettingsStatusFilter("all");
              }}
            >
              <Segment.Item id="ops">Operatie</Segment.Item>
              <Segment.Item id="team">Medewerkers</Segment.Item>
              <Segment.Item id="legal">Juridisch</Segment.Item>
            </Segment>

            {settingsView === "ops" ? (
              <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="field-stack">
                    <Label>Zoeken</Label>
                    <Input
                      fullWidth
                      placeholder="Zoek op vestiging, stad of manager"
                      value={settingsSearch}
                      onChange={(event) => setSettingsSearch(event.target.value)}
                    />
                  </div>
                  <label className="field-stack">
                    <span className="text-sm font-medium">Filter</span>
                    <select
                      className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                      value={settingsStatusFilter}
                      onChange={(event) => setSettingsStatusFilter(event.target.value)}
                    >
                      <option value="all">Alle statussen</option>
                      <option value="active">Actief</option>
                      <option value="paused">Gepauzeerd</option>
                      <option value="archived">Gearchiveerd</option>
                    </select>
                  </label>
                </div>
                {filteredLocations.length > 0 ? (
                <DashboardEntityDataGrid
                  ariaLabel="Vestigingen"
                  columns={locationColumns}
                  contentClassName="min-w-[980px]"
                  data={filteredLocations}
                  defaultSortDescriptor={{ column: "name", direction: "ascending" }}
                  getRowId={(location) => location.id}
                  getActionsProps={(location) => ({
                    endpoint: "/api/platform/locations",
                    entityLabel: `Vestiging ${location.name}`,
                    updatePayloadBase: {
                      id: location.id,
                      expectedVersion: location.version,
                    },
                    archivePayload: {
                      id: location.id,
                      expectedVersion: location.version,
                    },
                    deletePayload: {
                      id: location.id,
                      expectedVersion: location.version,
                    },
                    fields: [
                      { name: "name", label: "Naam", defaultValue: location.name },
                      { name: "city", label: "Stad", defaultValue: location.city },
                      {
                        name: "neighborhood",
                        label: "Wijk",
                        defaultValue: location.neighborhood,
                      },
                      {
                        name: "capacity",
                        label: "Capaciteit",
                        defaultValue: location.capacity,
                        type: "number",
                      },
                      {
                        name: "managerName",
                        label: "Manager",
                        defaultValue: location.managerName,
                      },
                      {
                        name: "status",
                        label: "Status",
                        defaultValue: location.status,
                        type: "select",
                        options: [
                          { value: "active", label: "Actief" },
                          { value: "paused", label: "Gepauzeerd" },
                          { value: "archived", label: "Gearchiveerd" },
                        ],
                      },
                      {
                        name: "amenities",
                        label: "Voorzieningen",
                        defaultValue: location.amenities,
                        type: "list",
                      },
                    ],
                  })}
                />
                ) : (
                  <EmptyPanel
                    title="Geen vestigingen gevonden"
                    description="Pas je zoekterm of statusfilter aan om meer vestigingen te tonen."
                  />
                )}

                {snapshot.uiCapabilities.canManageOwnerAccounts ? (
                  <Card className="rounded-2xl border-border/80 bg-surface-secondary">
                    <Card.Content className="space-y-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        <p className="font-medium">Platformbeheer</p>
                      </div>
                      <p className="text-muted text-sm leading-6">
                        Beheer eigenaarsaccounts en platforminstellingen vanaf de beheerpagina.
                      </p>
                      <Link
                        href="/dashboard/superadmin"
                        prefetch={false}
                        className="inline-flex w-fit rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium"
                      >
                        Open platformbeheer
                      </Link>
                    </Card.Content>
                  </Card>
                ) : null}
              </div>
            ) : settingsView === "team" ? (
              snapshot.staff.length > 0 || snapshot.trainers.length > 0 ? (
                <>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="field-stack">
                    <Label>Zoeken</Label>
                    <Input
                      fullWidth
                      placeholder="Zoek op naam, e-mail of rol"
                      value={settingsSearch}
                      onChange={(event) => setSettingsSearch(event.target.value)}
                    />
                  </div>
                  <label className="field-stack">
                    <span className="text-sm font-medium">Filter</span>
                    <select
                      className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                      value={settingsStatusFilter}
                      onChange={(event) => setSettingsStatusFilter(event.target.value)}
                    >
                      <option value="all">Alle statussen</option>
                      <option value="active">Actief</option>
                      <option value="away">Afwezig</option>
                      <option value="archived">Gearchiveerd</option>
                    </select>
                  </label>
                </div>
                {snapshot.trainers.length > 0 ? (
                  filteredTrainers.length > 0 ? (
                    <div className="grid gap-3">
                      <p className="text-sm font-semibold">Trainers</p>
                      <DashboardEntityDataGrid
                        ariaLabel="Trainers"
                        columns={trainerColumns}
                        contentClassName="min-w-[900px]"
                        data={filteredTrainers}
                        defaultSortDescriptor={{ column: "fullName", direction: "ascending" }}
                        getRowId={(trainer) => trainer.id}
                        getActionsProps={(trainer) => ({
                          endpoint: "/api/platform/trainers",
                          entityLabel: `Trainer ${trainer.fullName}`,
                          updatePayloadBase: {
                            id: trainer.id,
                            expectedVersion: trainer.version,
                          },
                          archivePayload: {
                            id: trainer.id,
                            expectedVersion: trainer.version,
                          },
                          deletePayload: {
                            id: trainer.id,
                            expectedVersion: trainer.version,
                          },
                          fields: [
                            {
                              name: "fullName",
                              label: "Naam",
                              defaultValue: trainer.fullName,
                            },
                            {
                              name: "homeLocationId",
                              label: "Vestiging",
                              defaultValue: trainer.homeLocationId,
                              type: "select",
                              options: snapshot.locations.map((location) => ({
                                value: location.id,
                                label: location.name,
                              })),
                            },
                            {
                              name: "status",
                              label: "Status",
                              defaultValue: trainer.status,
                              type: "select",
                              options: [
                                { value: "active", label: "Actief" },
                                { value: "away", label: "Afwezig" },
                                { value: "archived", label: "Gearchiveerd" },
                              ],
                            },
                            {
                              name: "specialties",
                              label: "Specialisaties",
                              defaultValue: trainer.specialties,
                              type: "list",
                            },
                            {
                              name: "certifications",
                              label: "Certificeringen",
                              defaultValue: trainer.certifications,
                              type: "list",
                            },
                          ],
                        })}
                      />
                    </div>
                  ) : (
                    <EmptyPanel
                      title="Geen trainers gevonden"
                      description="Pas je zoekterm of statusfilter aan om meer trainers te tonen."
                    />
                  )
                ) : null}
                {filteredStaff.length > 0 ? (
                <>
                <p className="text-sm font-semibold">Medewerkeraccounts</p>
                <DashboardEntityDataGrid
                  ariaLabel="Medewerkeraccounts"
                  columns={staffColumns}
                  contentClassName="min-w-[760px]"
                  data={filteredStaff}
                  defaultSortDescriptor={{ column: "displayName", direction: "ascending" }}
                  getRowId={(member) => member.id}
                  getActionsProps={(member) => ({
                    endpoint: "/api/platform/staff",
                    entityLabel: `Medewerker ${member.displayName}`,
                    updatePayloadBase: {
                      userId: member.id,
                      expectedUpdatedAt: member.updatedAt ?? "",
                    },
                    archivePayload: {
                      userId: member.id,
                      expectedUpdatedAt: member.updatedAt ?? "",
                    },
                    deletePayload: {
                      userId: member.id,
                      expectedUpdatedAt: member.updatedAt ?? "",
                    },
                    fields: [
                      {
                        name: "displayName",
                        label: "Naam",
                        defaultValue: member.displayName,
                      },
                      { name: "email", label: "E-mail", defaultValue: member.email, type: "email" },
                      {
                        name: "roleKey",
                        label: "Rol",
                        defaultValue: member.roleKey ?? "frontdesk",
                        type: "select",
                        options: [
                          { value: "owner", label: "Eigenaar" },
                          { value: "manager", label: "Manager" },
                          { value: "trainer", label: "Trainer" },
                          { value: "frontdesk", label: "Balie" },
                        ],
                      },
                      {
                        name: "status",
                        label: "Status",
                        defaultValue: member.status,
                        type: "select",
                        options: [
                          { value: "active", label: "Actief" },
                          { value: "archived", label: "Gearchiveerd" },
                        ],
                      },
                    ],
                  })}
                />
                </>
                ) : (
                  <EmptyPanel
                    title={snapshot.staff.length > 0 ? "Geen medewerkers gevonden" : "Nog geen medewerkeraccounts"}
                    description="Pas je zoekterm of statusfilter aan om meer medewerkers te tonen."
                  />
                )}
                </>
              ) : (
                <EmptyPanel
                  title="Nog geen medewerkeraccounts"
                  description="Nodig de rest van je medewerkers uit zodra de werkruimte klaar is."
                />
              )
            ) : (
              <div className="grid gap-3">
                <Card className="rounded-2xl border-border/80 bg-surface-secondary">
                  <Card.Content className="space-y-2">
                    <p className="font-medium">Voorwaarden</p>
                    <p className="text-muted text-sm">{snapshot.legal.termsUrl}</p>
                  </Card.Content>
                </Card>
                <Card className="rounded-2xl border-border/80 bg-surface-secondary">
                  <Card.Content className="space-y-2">
                    <p className="font-medium">Privacy</p>
                    <p className="text-muted text-sm">{snapshot.legal.privacyUrl}</p>
                  </Card.Content>
                </Card>
                <Card className="rounded-2xl border-border/80 bg-surface-secondary">
                  <Card.Content className="space-y-2">
                    <p className="font-medium">Waiveropslag</p>
                    <p className="text-muted text-sm">
                      {snapshot.legal.waiverStorageKey} · {snapshot.legal.waiverRetentionMonths} maanden
                    </p>
                  </Card.Content>
                </Card>
              </div>
            )}
        </div>
      </PageSection>

      <LazyPlatformWorkbench
        sections={["locations", "trainers", "staff", "legal"]}
        showLaunchHeader={false}
        snapshot={snapshot}
        stackSections
      />

      <PageSection
        title="Gym instellingsmodules"
        description="Compact overzicht van clubmodules voor vestigingen, medewerkers en operatie."
      >
        <FeatureModuleBoard currentPage="settings" features={settingsFeatures} snapshot={snapshot} />
      </PageSection>
    </div>
  );
}
