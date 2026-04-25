"use client";

import { Card, Chip } from "@heroui/react";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import { LazyPlatformWorkbench } from "@/components/dashboard/LazyPlatformWorkbench";
import { EmptyPanel, PageSection, type DashboardPageProps } from "@/components/dashboard/shared";
import { getMembershipBillingCycleLabel } from "@/lib/memberships";

export function ContractsDashboardPage({ snapshot }: DashboardPageProps) {
  const contractFeatures = snapshot.featureFlags.filter(
    (feature) => feature.dashboardPage === "contracts",
  );

  return (
    <div className="section-stack">
      <PageSection
        title="Membership stack"
        description="Contractbeheer, credits en imports kunnen per tenant bewust worden vrijgegeven."
      >
        <FeatureModuleBoard features={contractFeatures} snapshot={snapshot} />
      </PageSection>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
        <PageSection
          title="Memberships"
          description="Commercial plans and imported member data."
        >
          {snapshot.membershipPlans.length > 0 ? (
            <div className="grid gap-3">
              {snapshot.membershipPlans.map((plan) => (
                <Card key={plan.id} className="rounded-2xl border-border/80">
                  <Card.Content className="grid gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium">{plan.name}</p>
                      <Chip size="sm" variant="soft">
                        {getMembershipBillingCycleLabel(plan.billingCycle)}
                      </Chip>
                    </div>
                    <p className="text-muted text-sm">
                      EUR {plan.priceMonthly}/month · {plan.activeMembers} active members
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {plan.perks.map((perk) => (
                        <Chip key={perk} size="sm" variant="tertiary">
                          {perk}
                        </Chip>
                      ))}
                    </div>
                  </Card.Content>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyPanel
              title="No memberships yet"
              description="Add the membership plans your gym actually sells."
            />
          )}
        </PageSection>

        <LazyPlatformWorkbench
          sections={["contracts", "imports"]}
          showLaunchHeader={false}
          snapshot={snapshot}
        />
      </div>
    </div>
  );
}
