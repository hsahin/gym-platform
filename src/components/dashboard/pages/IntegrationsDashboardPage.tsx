"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActivitySquare, Database, Link2, PlugZap } from "lucide-react";
import { Card, Chip, Input, Label } from "@heroui/react";
import { Button } from "@/components/dashboard/HydrationSafeButton";
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
import { getSystemCacheModeLabel, getSystemHealthStatusLabel } from "@/lib/ui-labels";
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
  const canViewPlatformChecks = snapshot.uiCapabilities.canViewPlatformChecks;
  const attentionChecks = canViewPlatformChecks
    ? snapshot.healthReport.checks.filter((check) => check.status !== "healthy")
    : [];

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
        title="Integraties instellen"
        description="Leg vast welke leveranciers, migratiebron en meetapparatuur jouw club gebruikt."
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
              <Label>Hardwareleveranciers</Label>
              <Input
                fullWidth
                value={hardwareVendors}
                onChange={(event) => setHardwareVendors(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Softwarekoppelingen</Label>
              <Input
                fullWidth
                value={softwareIntegrations}
                onChange={(event) => setSoftwareIntegrations(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Apparaatkoppelingen</Label>
              <Input
                fullWidth
                value={equipmentIntegrations}
                onChange={(event) => setEquipmentIntegrations(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Migratiebron</Label>
              <Input
                fullWidth
                value={migrationProvider}
                onChange={(event) => setMigrationProvider(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Lichaamssamenstelling</Label>
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
            label: "Hardwarestatus",
            value: snapshot.remoteAccess.statusLabel,
            helper: "Slimme sloten en clubhardware volgen hetzelfde koppelmodel.",
          },
          {
            icon: Database,
            label: "Betaalkoppeling",
            value: snapshot.payments.statusLabel,
            helper: "Betaalprovider en incassostatus kunnen als integratiebron fungeren.",
          },
          ...(canViewPlatformChecks
            ? [
                {
                  icon: Link2,
                  label: "Systeemversnelling",
                  value: getSystemCacheModeLabel(snapshot.runtime.cacheMode),
                  helper:
                    "Achtergrondservices bepalen hoe betrouwbaar koppelingen reageren.",
                },
                {
                  icon: ActivitySquare,
                  label: "Aandachtspunten",
                  value: String(attentionChecks.length),
                  helper: "Gebruik statuschecks om koppelingen veilig live te houden.",
                },
              ]
            : []),
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

      {canViewPlatformChecks ? (
        <PageSection
          title="Integratiestatus"
          description="Checks met aandacht tonen welke koppelingen of systeemonderdelen nog opvolging nodig hebben."
        >
          {attentionChecks.length > 0 ? (
            <ListView aria-label="Integratiestatuschecks" items={attentionChecks}>
              {(check) => (
                <ListView.Item id={check.name} textValue={check.name}>
                  <ListView.ItemContent>
                    <ListView.Title>{check.name}</ListView.Title>
                    <ListView.Description>{check.summary}</ListView.Description>
                  </ListView.ItemContent>
                  <Chip size="sm" variant="tertiary">
                    {getSystemHealthStatusLabel(check.status)}
                  </Chip>
                </ListView.Item>
              )}
            </ListView>
          ) : (
            <EmptyPanel
              title="Geen open integratieproblemen"
              description="Alle bekende systeem- en koppelingchecks staan momenteel gezond."
            />
          )}
        </PageSection>
      ) : null}

      <PageSection
        title="Integratiemodules"
        description="Compact overzicht van hardware, externe software en apparaatgegevens."
      >
        <FeatureModuleBoard currentPage="integrations" features={integrationFeatures} snapshot={snapshot} />
      </PageSection>
    </div>
  );
}
