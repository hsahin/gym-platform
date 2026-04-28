"use client";

import { useState } from "react";
import { Card, Chip } from "@heroui/react";
import { DashboardEntityActions } from "@/components/DashboardEntityActions";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import { LazyPlatformWorkbench } from "@/components/dashboard/LazyPlatformWorkbench";
import { EmptyPanel, PageSection, type DashboardPageProps } from "@/components/dashboard/shared";
import { filterManagementRecords } from "@/lib/dashboard-management";
import { getMembershipBillingCycleLabel } from "@/lib/memberships";

export function ContractsDashboardPage({ snapshot }: DashboardPageProps) {
  const [planSearch, setPlanSearch] = useState("");
  const [planStatusFilter, setPlanStatusFilter] = useState("all");
  const contractFeatures = snapshot.featureFlags.filter(
    (feature) => feature.dashboardPage === "contracts",
  );
  const filteredPlans = filterManagementRecords(snapshot.membershipPlans, {
    query: planSearch,
    searchKeys: ["name", "billingCycle", "perks"],
    filterKey: "status",
    filterValue: planStatusFilter,
  });

  return (
    <div className="section-stack">
      <PageSection
        title="Contracten en lidmaatschappen"
        description="Contractbeheer, credits en imports kunnen per tenant bewust worden vrijgegeven."
      >
        <FeatureModuleBoard features={contractFeatures} snapshot={snapshot} />
      </PageSection>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
        <PageSection
          title="Lidmaatschappen"
          description="Commerciële plannen en geïmporteerde ledencontracten."
        >
          {snapshot.membershipPlans.length > 0 ? (
            <>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <label className="field-stack">
                <span className="text-sm font-medium">Zoeken</span>
                <input
                  className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                  placeholder="Zoek op naam, duur of voordeel"
                  value={planSearch}
                  onChange={(event) => setPlanSearch(event.target.value)}
                />
              </label>
              <label className="field-stack">
                <span className="text-sm font-medium">Filter</span>
                <select
                  className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                  value={planStatusFilter}
                  onChange={(event) => setPlanStatusFilter(event.target.value)}
                >
                  <option value="all">Alle statussen</option>
                  <option value="active">Actief</option>
                  <option value="paused">Gepauzeerd</option>
                  <option value="archived">Gearchiveerd</option>
                </select>
              </label>
            </div>
            {filteredPlans.length > 0 ? (
            <div className="grid gap-3">
              {filteredPlans.map((plan) => (
                <Card key={plan.id} className="rounded-2xl border-border/80">
                  <Card.Content className="grid gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium">{plan.name}</p>
                      <div className="flex flex-wrap gap-2">
                        <Chip size="sm" variant="soft">
                          {getMembershipBillingCycleLabel(plan.billingCycle)}
                        </Chip>
                        <Chip size="sm" variant="tertiary">
                          {plan.status}
                        </Chip>
                      </div>
                    </div>
                    <p className="text-muted text-sm">
                      EUR {plan.priceMonthly}/maand · {plan.activeMembers} actieve leden
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {plan.perks.map((perk) => (
                        <Chip key={perk} size="sm" variant="tertiary">
                          {perk}
                        </Chip>
                      ))}
                    </div>
                    <DashboardEntityActions
                      endpoint="/api/platform/membership-plans"
                      entityLabel={`Lidmaatschap ${plan.name}`}
                      updatePayloadBase={{
                        id: plan.id,
                        expectedVersion: plan.version,
                      }}
                      archivePayload={{
                        id: plan.id,
                        expectedVersion: plan.version,
                      }}
                      deletePayload={{
                        id: plan.id,
                        expectedVersion: plan.version,
                      }}
                      fields={[
                        { name: "name", label: "Naam", defaultValue: plan.name },
                        {
                          name: "priceMonthly",
                          label: "Prijs per maand",
                          defaultValue: plan.priceMonthly,
                          type: "number",
                        },
                        {
                          name: "billingCycle",
                          label: "Contractduur",
                          defaultValue: plan.billingCycle,
                          type: "select",
                          options: [
                            { value: "monthly", label: "Maand" },
                            { value: "semiannual", label: "6 maanden" },
                            { value: "annual", label: "Jaar" },
                          ],
                        },
                        {
                          name: "status",
                          label: "Status",
                          defaultValue: plan.status,
                          type: "select",
                          options: [
                            { value: "active", label: "Actief" },
                            { value: "paused", label: "Gepauzeerd" },
                            { value: "archived", label: "Gearchiveerd" },
                          ],
                        },
                        {
                          name: "perks",
                          label: "Voordelen",
                          defaultValue: plan.perks,
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
                title="Geen lidmaatschappen gevonden"
                description="Pas je zoekterm of statusfilter aan om meer contracten te tonen."
              />
            )}
            </>
          ) : (
            <EmptyPanel
              title="Nog geen lidmaatschappen"
              description="Voeg de lidmaatschappen toe die je sportschool echt verkoopt."
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
