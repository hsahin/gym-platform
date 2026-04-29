"use client";

import { DoorOpen, ShieldCheck } from "lucide-react";
import { Card, Chip } from "@heroui/react";
import { ListView } from "@/components/dashboard/HydrationSafeListView";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import { LazyPlatformWorkbench } from "@/components/dashboard/LazyPlatformWorkbench";
import { PageSection, formatDateTime, type DashboardPageProps } from "@/components/dashboard/shared";

export function AccessDashboardPage({ snapshot }: DashboardPageProps) {
  const accessFeatures = snapshot.featureFlags.filter(
    (feature) => feature.dashboardPage === "access",
  );

  return (
    <div className="section-stack">
      <PageSection
        title="Remote access"
        description="Current device state and recent operator actions."
      >
        <div className="grid gap-4">
          <Card className="rounded-2xl border-border/80 bg-surface-secondary">
            <Card.Content className="space-y-3">
              <div className="flex items-center gap-2">
                <DoorOpen className="h-4 w-4" />
                <p className="font-medium">{snapshot.remoteAccess.deviceLabel}</p>
              </div>
              <p className="text-muted text-sm">{snapshot.remoteAccess.helpText}</p>
              <div className="flex flex-wrap gap-2">
                <Chip size="sm" variant="soft">
                  {snapshot.remoteAccess.statusLabel}
                </Chip>
                {snapshot.remoteAccess.locationName ? (
                  <Chip size="sm" variant="tertiary">
                    {snapshot.remoteAccess.locationName}
                  </Chip>
                ) : null}
              </div>
            </Card.Content>
          </Card>

          {snapshot.auditEntries.length > 0 ? (
            <ListView aria-label="Recent access events" items={snapshot.auditEntries}>
              {(entry) => (
                <ListView.Item id={entry.eventId} textValue={entry.action}>
                  <ListView.ItemContent>
                    <ListView.Title>{entry.action}</ListView.Title>
                    <ListView.Description>{formatDateTime(entry.occurredAt)}</ListView.Description>
                  </ListView.ItemContent>
                  <ShieldCheck className="text-muted h-4 w-4" />
                </ListView.Item>
              )}
            </ListView>
          ) : null}
        </div>
      </PageSection>

      <LazyPlatformWorkbench
        sections={["remote-access"]}
        showLaunchHeader={false}
        snapshot={snapshot}
        stackSections
      />

      <PageSection
        title="Toegangsmodules"
        description="Compact overzicht van slimme toegang en owner-controlled open-acties."
      >
        <FeatureModuleBoard features={accessFeatures} snapshot={snapshot} />
      </PageSection>
    </div>
  );
}
