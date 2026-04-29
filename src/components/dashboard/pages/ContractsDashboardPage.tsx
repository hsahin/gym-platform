"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Input, Label } from "@heroui/react";
import { toast } from "sonner";
import { DashboardEntityActions } from "@/components/DashboardEntityActions";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import { LazyPlatformWorkbench } from "@/components/dashboard/LazyPlatformWorkbench";
import { submitDashboardMutation } from "@/components/dashboard/dashboard-client-helpers";
import {
  EmptyPanel,
  PageSection,
  formatDate,
  type DashboardPageProps,
} from "@/components/dashboard/shared";
import { filterManagementRecords } from "@/lib/dashboard-management";
import { getMembershipBillingCycleLabel } from "@/lib/memberships";

function defaultCreditValidUntil() {
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  return nextYear.toISOString().slice(0, 10);
}

export function ContractsDashboardPage({ snapshot }: DashboardPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [planSearch, setPlanSearch] = useState("");
  const [planStatusFilter, setPlanStatusFilter] = useState("all");
  const [packMemberId, setPackMemberId] = useState(snapshot.members[0]?.id ?? "");
  const [packTrainerId, setPackTrainerId] = useState(snapshot.trainers[0]?.id ?? "");
  const [packTitle, setPackTitle] = useState(
    `Credit pack ${snapshot.bookingWorkspace.defaultCreditPackSize} credits`,
  );
  const [packCredits, setPackCredits] = useState(
    snapshot.bookingWorkspace.defaultCreditPackSize,
  );
  const [packValidUntil, setPackValidUntil] = useState(defaultCreditValidUntil);
  const contractFeatures = snapshot.featureFlags.filter(
    (feature) => feature.dashboardPage === "contracts",
  );
  const filteredPlans = filterManagementRecords(snapshot.membershipPlans, {
    query: planSearch,
    searchKeys: ["name", "billingCycle", "perks"],
    filterKey: "status",
    filterValue: planStatusFilter,
  });
  const trainerNamesById = new Map(
    snapshot.trainers.map((trainer) => [trainer.id, trainer.fullName]),
  );
  const totalPacks = snapshot.appointments.creditPacks.length;
  const totalCredits = snapshot.appointments.creditPacks.reduce(
    (sum, pack) => sum + pack.totalCredits,
    0,
  );
  const remainingCredits = snapshot.appointments.creditPacks.reduce(
    (sum, pack) => sum + pack.remainingCredits,
    0,
  );
  const usedCredits = totalCredits - remainingCredits;
  const selectedMember = snapshot.members.find((member) => member.id === packMemberId);
  const selectedTrainer = snapshot.trainers.find((trainer) => trainer.id === packTrainerId);
  const canCreateCreditPack = Boolean(selectedMember && selectedTrainer);

  useEffect(() => {
    if (!snapshot.members.some((member) => member.id === packMemberId)) {
      setPackMemberId(snapshot.members[0]?.id ?? "");
    }

    if (!snapshot.trainers.some((trainer) => trainer.id === packTrainerId)) {
      setPackTrainerId(snapshot.trainers[0]?.id ?? "");
    }
  }, [packMemberId, packTrainerId, snapshot.members, snapshot.trainers]);

  function createCreditPack() {
    if (!selectedMember || !selectedTrainer) {
      toast.error("Voeg eerst minimaal één lid en één trainer toe voordat je credits verkoopt.");
      return;
    }

    startTransition(async () => {
      try {
        await submitDashboardMutation("/api/platform/appointments", {
          operation: "create_pack",
          memberId: selectedMember.id,
          memberName: selectedMember.fullName,
          trainerId: selectedTrainer.id,
          title: packTitle,
          totalCredits: packCredits,
          validUntil: packValidUntil,
        });
        toast.success("Credit pack toegevoegd.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Credit pack toevoegen mislukt.");
      }
    });
  }

  return (
    <div className="section-stack">
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
        stackSections
      />

      <PageSection
        title="Creditsysteem"
        description="Beheer losse credits, PT-packs en class packs naast je vaste lidmaatschappen."
        actions={
          <Button
            isDisabled={isPending || !canCreateCreditPack}
            variant="outline"
            onPress={createCreditPack}
          >
            {isPending ? "Opslaan..." : "Pack toevoegen"}
          </Button>
        }
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Card className="rounded-2xl border-border/80 bg-surface-secondary shadow-none">
            <Card.Content className="space-y-2">
              <p className="text-muted text-sm">Standaard pack</p>
              <p className="text-2xl font-semibold">
                {snapshot.bookingWorkspace.defaultCreditPackSize}
              </p>
              <p className="text-muted text-xs">credits per nieuw pack</p>
            </Card.Content>
          </Card>
          <Card className="rounded-2xl border-border/80 bg-surface-secondary shadow-none">
            <Card.Content className="space-y-2">
              <p className="text-muted text-sm">Verkochte packs</p>
              <p className="text-2xl font-semibold">{totalPacks}</p>
              <p className="text-muted text-xs">actieve creditbundels</p>
            </Card.Content>
          </Card>
          <Card className="rounded-2xl border-border/80 bg-surface-secondary shadow-none">
            <Card.Content className="space-y-2">
              <p className="text-muted text-sm">Open credits</p>
              <p className="text-2xl font-semibold">{remainingCredits}</p>
              <p className="text-muted text-xs">nog te besteden</p>
            </Card.Content>
          </Card>
          <Card className="rounded-2xl border-border/80 bg-surface-secondary shadow-none">
            <Card.Content className="space-y-2">
              <p className="text-muted text-sm">Gebruikt</p>
              <p className="text-2xl font-semibold">{usedCredits}</p>
              <p className="text-muted text-xs">credits ingepland</p>
            </Card.Content>
          </Card>
        </div>

        <Card className="rounded-[28px] border border-border/80 bg-surface-secondary shadow-none">
          <Card.Header>
            <Card.Title>Credit pack verkopen</Card.Title>
            <Card.Description>
              Koppel credits aan een lid en trainer. Deze packs zijn direct bruikbaar bij PT- en
              afspraakplanning.
            </Card.Description>
          </Card.Header>
          <Card.Content className="grid gap-4 md:grid-cols-2">
            <label className="field-stack">
              <span className="text-sm font-medium">Lid</span>
              <select
                className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                value={packMemberId}
                onChange={(event) => setPackMemberId(event.target.value)}
              >
                {snapshot.members.length === 0 ? (
                  <option value="">Voeg eerst een lid toe</option>
                ) : null}
                {snapshot.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-stack">
              <span className="text-sm font-medium">Trainer</span>
              <select
                className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                value={packTrainerId}
                onChange={(event) => setPackTrainerId(event.target.value)}
              >
                {snapshot.trainers.length === 0 ? (
                  <option value="">Voeg eerst een trainer toe</option>
                ) : null}
                {snapshot.trainers.map((trainer) => (
                  <option key={trainer.id} value={trainer.id}>
                    {trainer.fullName}
                  </option>
                ))}
              </select>
            </label>
            <div className="field-stack">
              <Label>Titel</Label>
              <Input
                fullWidth
                value={packTitle}
                onChange={(event) => setPackTitle(event.target.value)}
              />
            </div>
            <div className="field-stack">
              <Label>Credits</Label>
              <Input
                fullWidth
                min={1}
                type="number"
                value={String(packCredits)}
                onChange={(event) => setPackCredits(Number(event.target.value || "0"))}
              />
            </div>
            <div className="field-stack md:col-span-2">
              <Label>Geldig tot</Label>
              <Input
                fullWidth
                type="date"
                value={packValidUntil}
                onChange={(event) => setPackValidUntil(event.target.value)}
              />
            </div>
          </Card.Content>
        </Card>

        {snapshot.appointments.creditPacks.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {snapshot.appointments.creditPacks.map((pack) => (
              <Card key={pack.id} className="rounded-2xl border-border/80">
                <Card.Content className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{pack.title}</p>
                      <p className="text-muted text-sm">
                        {pack.memberName} · {trainerNamesById.get(pack.trainerId) ?? pack.trainerId}
                      </p>
                    </div>
                    <Chip size="sm" variant="soft">
                      {pack.remainingCredits}/{pack.totalCredits} credits
                    </Chip>
                  </div>
                  <p className="text-muted text-sm">Geldig tot {formatDate(pack.validUntil)}</p>
                </Card.Content>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyPanel
            title="Nog geen credit packs"
            description="Verkochte credit packs verschijnen hier zodra je de eerste bundel aan een lid koppelt."
          />
        )}
      </PageSection>

      <PageSection
        title="Contractmodules"
        description="Compact overzicht van uitbreidingen voor contractbeheer, credits en imports."
      >
        <FeatureModuleBoard currentPage="contracts" features={contractFeatures} snapshot={snapshot} />
      </PageSection>
    </div>
  );
}
