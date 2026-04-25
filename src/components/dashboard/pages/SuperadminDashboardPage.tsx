"use client";

import { ShieldCheck, ToggleLeft, Zap } from "lucide-react";
import { Card } from "@heroui/react";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import {
  EmptyPanel,
  PageSection,
  type DashboardPageProps,
} from "@/components/dashboard/shared";
import type { FeatureState } from "@/server/types";

function groupFeaturesByCategory(features: ReadonlyArray<FeatureState>) {
  const groups = new Map<
    string,
    {
      readonly title: string;
      readonly features: FeatureState[];
    }
  >();

  for (const feature of features) {
    const existing = groups.get(feature.categoryKey);

    if (existing) {
      existing.features.push(feature);
      continue;
    }

    groups.set(feature.categoryKey, {
      title: feature.categoryTitle,
      features: [feature],
    });
  }

  return [...groups.values()];
}

export function SuperadminDashboardPage({ snapshot }: DashboardPageProps) {
  if (!snapshot.uiCapabilities.canManageFeatureFlags) {
    return (
      <EmptyPanel
        title="Owner toegang vereist"
        description="Alleen owners kunnen feature flags beheren en modules tenant-breed aan- of uitzetten."
      />
    );
  }

  const groupedFeatures = groupFeaturesByCategory(snapshot.featureFlags);
  const enabledFeatures = snapshot.featureFlags.filter((feature) => feature.enabled).length;
  const newFeatures = snapshot.featureFlags.filter((feature) => feature.badgeLabel === "NEW").length;

  return (
    <div className="section-stack">
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          {
            icon: ToggleLeft,
            label: "Actieve features",
            value: `${enabledFeatures}/${snapshot.featureFlags.length}`,
            helper: "Modules die nu tenant-breed live staan in het dashboard.",
          },
          {
            icon: Zap,
            label: "Nieuwe launches",
            value: String(newFeatures),
            helper: "Nieuwe modules die je bewust kunt vrijgeven voor deze gym.",
          },
          {
            icon: ShieldCheck,
            label: "Beheermodel",
            value: "Owner scope",
            helper: "Alle toggles gelden tenant-level en blijven centraal beheerd.",
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

      {groupedFeatures.map((group) => (
        <PageSection
          key={group.title}
          title={group.title}
          description="Schakel modules per tenant in of uit zonder verborgen configuraties."
        >
          <FeatureModuleBoard editable features={group.features} snapshot={snapshot} />
        </PageSection>
      ))}
    </div>
  );
}
