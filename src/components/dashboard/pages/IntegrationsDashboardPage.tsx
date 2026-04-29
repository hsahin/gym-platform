"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActivitySquare, Database, Link2, PlugZap } from "lucide-react";
import { Button, Card, Chip, Input, Label } from "@heroui/react";
import { ListView } from "@/components/dashboard/HydrationSafeListView";
import {
  parseCommaList,
  submitDashboardMutation,
} from "@/components/dashboard/dashboard-client-helpers";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import {
  EmptyPanel,
  PageSection,
  type DashboardPageProps,
} from "@/components/dashboard/shared";
import { toast } from "sonner";

export function IntegrationsDashboardPage({ snapshot }: DashboardPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const integrationFeatures = snapshot.featureFlags.filter(
    (feature) => feature.dashboardPage === "integrations",
  );
  const [hardwareVendors, setHardwareVendors] = useState(
    snapshot.integrationWorkspace.hardwareVendors.join(", "),
  );
  const [softwareIntegrations, setSoftwareIntegrations] = useState(
    snapshot.integrationWorkspace.softwareIntegrations.join(", "),
  );
  const [equipmentIntegrations, setEquipmentIntegrations] = useState(
    snapshot.integrationWorkspace.equipmentIntegrations.join(", "),
  );
  const [migrationProvider, setMigrationProvider] = useState(
    snapshot.integrationWorkspace.migrationProvider,
  );
  const [bodyCompositionProvider, setBodyCompositionProvider] = useState(
    snapshot.integrationWorkspace.bodyCompositionProvider,
  );
  const attentionChecks = snapshot.healthReport.checks.filter(
    (check) => check.status !== "healthy",
  );

  useEffect(() => {
    setHardwareVendors(snapshot.integrationWorkspace.hardwareVendors.join(", "));
    setSoftwareIntegrations(snapshot.integrationWorkspace.softwareIntegrations.join(", "));
    setEquipmentIntegrations(snapshot.integrationWorkspace.equipmentIntegrations.join(", "));
    setMigrationProvider(snapshot.integrationWorkspace.migrationProvider);
    setBodyCompositionProvider(snapshot.integrationWorkspace.bodyCompositionProvider);
  }, [snapshot.integrationWorkspace]);

  return (
    <div className="section-stack">
      <PageSection
        title="Integration setup"
        description="Leg vast welke vendors, migratiebron en body composition tooling jouw tenant gebruikt."
        actions={
          <Button
            isDisabled={isPending}
            variant="outline"
            onPress={() =>
              startTransition(async () => {
                try {
                  await submitDashboardMutation("/api/platform/integration-settings", {
                    hardwareVendors: parseCommaList(hardwareVendors),
                    softwareIntegrations: parseCommaList(softwareIntegrations),
                    equipmentIntegrations: parseCommaList(equipmentIntegrations),
                    migrationProvider,
                    bodyCompositionProvider,
                  });
                  toast.success("Integratie-instellingen opgeslagen.");
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Integratie-instellingen opslaan mislukt.",
                  );
                }
              })
            }
          >
            {isPending ? "Opslaan..." : "Integraties opslaan"}
          </Button>
        }
      >
        <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
          <Card.Content className="grid gap-4 md:grid-cols-2">
            <div className="field-stack">
              <Label>Hardware vendors</Label>
              <Input
                fullWidth
                value={hardwareVendors}
                onChange={(event) => setHardwareVendors(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Software integrations</Label>
              <Input
                fullWidth
                value={softwareIntegrations}
                onChange={(event) => setSoftwareIntegrations(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Equipment integrations</Label>
              <Input
                fullWidth
                value={equipmentIntegrations}
                onChange={(event) => setEquipmentIntegrations(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Migration provider</Label>
              <Input
                fullWidth
                value={migrationProvider}
                onChange={(event) => setMigrationProvider(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Body composition provider</Label>
              <Input
                fullWidth
                value={bodyCompositionProvider}
                onChange={(event) => setBodyCompositionProvider(event.target.value)}
              />
            </div>
          </Card.Content>
        </Card>
      </PageSection>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {[
          {
            icon: PlugZap,
            label: "Hardware state",
            value: snapshot.remoteAccess.statusLabel,
            helper: "Smart locks en clubhardware volgen hetzelfde connection model.",
          },
          {
            icon: Database,
            label: "Billing bridge",
            value: snapshot.payments.statusLabel,
            helper: "Betaalprovider en incassostatus kunnen als integratiebron fungeren.",
          },
          {
            icon: Link2,
            label: "Runtime cache",
            value: snapshot.runtime.cacheMode,
            helper: "Cache-, messaging- en storage-modes bepalen integratiebetrouwbaarheid.",
          },
          {
            icon: ActivitySquare,
            label: "Aandacht checks",
            value: String(attentionChecks.length),
            helper: "Gebruik health-checks om koppelingen veilig live te houden.",
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
        title="Integration health"
        description="Checks met aandacht tonen welke koppelingen of runtime onderdelen nog opvolging nodig hebben."
      >
        {attentionChecks.length > 0 ? (
          <ListView aria-label="Integration health checks" items={attentionChecks}>
            {(check) => (
              <ListView.Item id={check.name} textValue={check.name}>
                <ListView.ItemContent>
                  <ListView.Title>{check.name}</ListView.Title>
                  <ListView.Description>{check.summary}</ListView.Description>
                </ListView.ItemContent>
                <Chip size="sm" variant="tertiary">
                  {check.status}
                </Chip>
              </ListView.Item>
            )}
          </ListView>
        ) : (
          <EmptyPanel
            title="Geen open integratieproblemen"
            description="Alle bekende runtime- en koppelingchecks staan momenteel gezond."
          />
        )}
      </PageSection>

      <PageSection
        title="Integratiemodules"
        description="Compact overzicht van hardware, externe software en equipment-data."
      >
        <FeatureModuleBoard currentPage="integrations" features={integrationFeatures} snapshot={snapshot} />
      </PageSection>
    </div>
  );
}
