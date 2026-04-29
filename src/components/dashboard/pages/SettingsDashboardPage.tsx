"use client";

import Link from "next/link";
import { useState } from "react";
import { ShieldCheck, Users } from "lucide-react";
import { Card, Chip, Input, Label } from "@heroui/react";
import { ListView } from "@/components/dashboard/HydrationSafeListView";
import { Segment } from "@heroui-pro/react/segment";
import { DashboardEntityActions } from "@/components/DashboardEntityActions";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import { LazyPlatformWorkbench } from "@/components/dashboard/LazyPlatformWorkbench";
import { EmptyPanel, PageSection, type DashboardPageProps } from "@/components/dashboard/shared";
import { filterManagementRecords } from "@/lib/dashboard-management";

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

  return (
    <div className="section-stack">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
        <PageSection
          title="Instellingen"
          description="Vestigingen, runtime, team en juridische gereedheid."
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
              <Segment.Item id="team">Team</Segment.Item>
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
                filteredLocations.map((location) => (
                  <Card key={location.id} className="rounded-2xl border-border/80">
                    <Card.Content className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-medium">{location.name}</p>
                        <Chip size="sm" variant="tertiary">
                          {location.status}
                        </Chip>
                      </div>
                      <p className="text-muted text-sm">
                        {location.city} · {location.neighborhood} · {location.capacity} capaciteit
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {location.amenities.map((amenity) => (
                          <Chip key={amenity} size="sm" variant="tertiary">
                            {amenity}
                          </Chip>
                        ))}
                      </div>
                      <DashboardEntityActions
                        endpoint="/api/platform/locations"
                        entityLabel={`Vestiging ${location.name}`}
                        updatePayloadBase={{
                          id: location.id,
                          expectedVersion: location.version,
                        }}
                        archivePayload={{
                          id: location.id,
                          expectedVersion: location.version,
                        }}
                        deletePayload={{
                          id: location.id,
                          expectedVersion: location.version,
                        }}
                        fields={[
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
                        ]}
                      />
                    </Card.Content>
                  </Card>
                ))
                ) : (
                  <EmptyPanel
                    title="Geen vestigingen gevonden"
                    description="Pas je zoekterm of statusfilter aan om meer vestigingen te tonen."
                  />
                )}

                {snapshot.uiCapabilities.canManageFeatureFlags ? (
                  <Card className="rounded-2xl border-border/80 bg-surface-secondary">
                    <Card.Content className="space-y-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        <p className="font-medium">Superadminbeheer</p>
                      </div>
                      <p className="text-muted text-sm leading-6">
                        Beheer alle tenant-level feature flags vanaf een aparte ownerpagina.
                      </p>
                      <Link
                        href="/dashboard/superadmin"
                        prefetch={false}
                        className="inline-flex w-fit rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium"
                      >
                        Open Superadmin
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
                      {filteredTrainers.map((trainer) => (
                        <Card key={trainer.id} className="rounded-2xl border-border/80">
                          <Card.Content className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="font-medium">{trainer.fullName}</p>
                              <Chip size="sm" variant="tertiary">
                                {trainer.status}
                              </Chip>
                            </div>
                            <p className="text-muted text-sm">
                              {snapshot.locations.find((location) => location.id === trainer.homeLocationId)?.name ??
                                "Onbekende vestiging"}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {[...trainer.specialties, ...trainer.certifications].map((label) => (
                                <Chip key={label} size="sm" variant="tertiary">
                                  {label}
                                </Chip>
                              ))}
                            </div>
                            <DashboardEntityActions
                              endpoint="/api/platform/trainers"
                              entityLabel={`Trainer ${trainer.fullName}`}
                              updatePayloadBase={{
                                id: trainer.id,
                                expectedVersion: trainer.version,
                              }}
                              archivePayload={{
                                id: trainer.id,
                                expectedVersion: trainer.version,
                              }}
                              deletePayload={{
                                id: trainer.id,
                                expectedVersion: trainer.version,
                              }}
                              fields={[
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
                              ]}
                            />
                          </Card.Content>
                        </Card>
                      ))}
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
                <p className="text-sm font-semibold">Teamaccounts</p>
                <ListView aria-label="Teamaccounts" items={filteredStaff}>
                  {(member) => (
                    <ListView.Item id={member.id} textValue={member.displayName}>
                      <ListView.ItemContent>
                        <ListView.Title>{member.displayName}</ListView.Title>
                        <ListView.Description>
                          {member.email} · {member.roles.join(", ")}
                        </ListView.Description>
                      </ListView.ItemContent>
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip size="sm" variant="tertiary">
                          {member.status}
                        </Chip>
                        <Users className="text-muted h-4 w-4" />
                      </div>
                      <DashboardEntityActions
                        endpoint="/api/platform/staff"
                        entityLabel={`Teamlid ${member.displayName}`}
                        updatePayloadBase={{
                          userId: member.id,
                          expectedUpdatedAt: member.updatedAt ?? "",
                        }}
                        archivePayload={{
                          userId: member.id,
                          expectedUpdatedAt: member.updatedAt ?? "",
                        }}
                        deletePayload={{
                          userId: member.id,
                          expectedUpdatedAt: member.updatedAt ?? "",
                        }}
                        fields={[
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
                              { value: "owner", label: "Owner" },
                              { value: "manager", label: "Manager" },
                              { value: "trainer", label: "Trainer" },
                              { value: "frontdesk", label: "Frontdesk" },
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
                        ]}
                      />
                    </ListView.Item>
                  )}
                </ListView>
                </>
                ) : (
                  <EmptyPanel
                    title={snapshot.staff.length > 0 ? "Geen teamleden gevonden" : "Nog geen teamaccounts"}
                    description="Pas je zoekterm of statusfilter aan om meer teamleden te tonen."
                  />
                )}
                </>
              ) : (
                <EmptyPanel
                  title="Nog geen teamaccounts"
                  description="Nodig de rest van het team uit zodra de werkruimte klaar is."
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
        />
      </div>

      <PageSection
        title="Instellingsmodules"
        description="Compact overzicht van feature-uitrol voor vestigingen, teambeheer en operatie."
      >
        <FeatureModuleBoard features={settingsFeatures} snapshot={snapshot} />
      </PageSection>
    </div>
  );
}
