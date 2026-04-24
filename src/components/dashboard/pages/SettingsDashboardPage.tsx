"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { Card, Chip } from "@heroui/react";
import { ListView } from "@heroui-pro/react/list-view";
import { Segment } from "@heroui-pro/react/segment";
import { LazyPlatformWorkbench } from "@/components/dashboard/LazyPlatformWorkbench";
import { EmptyPanel, PageSection, type DashboardPageProps } from "@/components/dashboard/shared";

export function SettingsDashboardPage({ snapshot }: DashboardPageProps) {
  const [settingsView, setSettingsView] = useState<"ops" | "team" | "legal">("ops");

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
      <PageSection
        title="Settings"
        description="Locations, runtime state, staff, and legal readiness."
      >
        <div className="grid content-start gap-3">
          <Segment
            className="w-full max-w-[28rem]"
            selectedKey={settingsView}
            size="sm"
            onSelectionChange={(key) => setSettingsView(String(key) as typeof settingsView)}
          >
            <Segment.Item id="ops">Operations</Segment.Item>
            <Segment.Item id="team">Team</Segment.Item>
            <Segment.Item id="legal">Legal</Segment.Item>
          </Segment>

          {settingsView === "ops" ? (
            <div className="grid gap-3">
              {snapshot.locations.map((location) => (
                <Card key={location.id} className="rounded-2xl border-border/80">
                  <Card.Content className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium">{location.name}</p>
                      <Chip size="sm" variant="tertiary">
                        {location.status}
                      </Chip>
                    </div>
                    <p className="text-muted text-sm">
                      {location.city} · {location.neighborhood} · {location.capacity} capacity
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {location.amenities.map((amenity) => (
                        <Chip key={amenity} size="sm" variant="tertiary">
                          {amenity}
                        </Chip>
                      ))}
                    </div>
                  </Card.Content>
                </Card>
              ))}
            </div>
          ) : settingsView === "team" ? (
            snapshot.staff.length > 0 ? (
              <ListView aria-label="Team accounts" items={snapshot.staff}>
                {(member) => (
                  <ListView.Item id={member.id} textValue={member.displayName}>
                    <ListView.ItemContent>
                      <ListView.Title>{member.displayName}</ListView.Title>
                      <ListView.Description>
                        {member.email} · {member.roles.join(", ")}
                      </ListView.Description>
                    </ListView.ItemContent>
                    <Users className="text-muted h-4 w-4" />
                  </ListView.Item>
                )}
              </ListView>
            ) : (
              <EmptyPanel
                title="No staff accounts"
                description="Invite the rest of the floor team when the workspace is ready."
              />
            )
          ) : (
            <div className="grid gap-3">
              <Card className="rounded-2xl border-border/80 bg-surface-secondary">
                <Card.Content className="space-y-2">
                  <p className="font-medium">Terms</p>
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
                  <p className="font-medium">Waiver storage</p>
                  <p className="text-muted text-sm">
                    {snapshot.legal.waiverStorageKey} · {snapshot.legal.waiverRetentionMonths} months
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
  );
}
