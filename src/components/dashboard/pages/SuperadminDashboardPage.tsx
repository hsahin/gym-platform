"use client";

import { useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, ShieldCheck, ToggleLeft, UserCog, Zap } from "lucide-react";
import { Button, Card, Chip, Input, Label } from "@heroui/react";
import { toast } from "sonner";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import {
  EmptyPanel,
  PageSection,
  type DashboardPageProps,
} from "@/components/dashboard/shared";
import { MUTATION_CSRF_TOKEN } from "@/server/http/platform-api";
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

async function submitOwnerAccountMutation(
  method: "POST" | "PATCH" | "DELETE",
  payload: Record<string, unknown>,
) {
  const response = await fetch("/api/platform/superadmin/owner-accounts", {
    method,
    headers: {
      "content-type": "application/json",
      "x-claimtech-csrf": MUTATION_CSRF_TOKEN,
      "x-idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as {
    ok: boolean;
    error?: { message: string };
  };

  if (!response.ok || !result.ok) {
    throw new Error(result.error?.message ?? "Owner-account kon niet worden opgeslagen.");
  }
}

export function SuperadminDashboardPage({ snapshot }: DashboardPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (
    !snapshot.uiCapabilities.canManageFeatureFlags &&
    !snapshot.uiCapabilities.canManageOwnerAccounts
  ) {
    return (
      <EmptyPanel
        title="Superadmin toegang vereist"
        description="Alleen superadmins kunnen owner accounts beheren. Owners kunnen alleen tenant-instellingen beheren."
      />
    );
  }

  const groupedFeatures = groupFeaturesByCategory(snapshot.featureFlags);
  const enabledFeatures = snapshot.featureFlags.filter((feature) => feature.enabled).length;
  const newFeatures = snapshot.featureFlags.filter((feature) => feature.badgeLabel === "NEW").length;
  const ownerAccounts = snapshot.superadmin.ownerAccounts;
  const tenantOptions = [
    ...new Map(
      ownerAccounts.map((account) => [
        account.tenantId,
        { id: account.tenantId, name: account.tenantName },
      ]),
    ).values(),
  ];

  function createOwnerAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await submitOwnerAccountMutation("POST", {
          tenantId: String(formData.get("tenantId") ?? ""),
          displayName: String(formData.get("displayName") ?? ""),
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
        });
        toast.success("Owner-account aangemaakt.");
        event.currentTarget.reset();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Owner-account kon niet worden aangemaakt.");
      }
    });
  }

  function updateOwnerAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await submitOwnerAccountMutation("PATCH", {
          tenantId: String(formData.get("tenantId") ?? ""),
          userId: String(formData.get("userId") ?? ""),
          expectedUpdatedAt: String(formData.get("expectedUpdatedAt") ?? ""),
          displayName: String(formData.get("displayName") ?? ""),
          email: String(formData.get("email") ?? ""),
          status: String(formData.get("status") ?? "active"),
        });
        toast.success("Owner-account bijgewerkt.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Owner-account kon niet worden bijgewerkt.");
      }
    });
  }

  function deleteOwnerAccount(account: (typeof ownerAccounts)[number]) {
    startTransition(async () => {
      try {
        await submitOwnerAccountMutation("DELETE", {
          tenantId: account.tenantId,
          userId: account.id,
          expectedUpdatedAt: account.updatedAt,
        });
        toast.success("Owner-account verwijderd.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Owner-account kon niet worden verwijderd.");
      }
    });
  }

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
            label: "Owner accounts",
            value: snapshot.uiCapabilities.canManageOwnerAccounts
              ? String(snapshot.superadmin.activeOwnerAccounts)
              : "Tenant scope",
            helper: snapshot.uiCapabilities.canManageOwnerAccounts
              ? `${snapshot.superadmin.archivedOwnerAccounts} gearchiveerde owner accounts.`
              : "Deze login beheert alleen feature flags binnen de huidige gym.",
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

      {snapshot.uiCapabilities.canManageOwnerAccounts ? (
        <PageSection
          title="Gym owner accounts"
          description="Beheer welke eigenaren toegang hebben tot hun gym. Dit is platform-breed en los van tenant feature flags."
        >
          <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
            <Card className="rounded-[24px] border border-border/80 bg-surface shadow-none">
              <Card.Header className="space-y-2">
                <div className="flex items-center gap-2">
                  <UserCog className="h-4 w-4 text-muted" />
                  <Card.Title>Nieuwe owner toevoegen</Card.Title>
                </div>
                <Card.Description>
                  Kies de gym, voeg een eigenaar toe en deel daarna veilig de inloggegevens.
                </Card.Description>
              </Card.Header>
              <Card.Content>
                <form className="grid gap-3" onSubmit={createOwnerAccount}>
                  <label className="field-stack">
                    <span className="text-sm font-medium">Gym</span>
                    <select
                      className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                      name="tenantId"
                      required
                    >
                      {tenantOptions.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="field-stack">
                    <Label>Naam owner</Label>
                    <Input fullWidth name="displayName" placeholder="Naam eigenaar" required />
                  </div>
                  <div className="field-stack">
                    <Label>E-mail</Label>
                    <Input fullWidth name="email" placeholder="owner@gym.nl" required type="email" />
                  </div>
                  <div className="field-stack">
                    <Label>Tijdelijk wachtwoord</Label>
                    <Input fullWidth name="password" minLength={8} required type="password" />
                  </div>
                  <Button isDisabled={isPending} type="submit" variant="primary">
                    Owner-account aanmaken
                  </Button>
                </form>
              </Card.Content>
            </Card>

            <div className="grid gap-3">
              {ownerAccounts.map((account) => (
                <Card key={account.id} className="rounded-[24px] border border-border/80 bg-surface shadow-none">
                  <Card.Content className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{account.displayName}</p>
                          <Chip
                            size="sm"
                            variant={account.status === "active" ? "soft" : "tertiary"}
                            color={account.status === "active" ? "success" : "default"}
                          >
                            {account.status}
                          </Chip>
                        </div>
                        <p className="text-muted text-sm">{account.email}</p>
                        <p className="text-muted flex items-center gap-1 text-sm">
                          <Building2 className="h-3.5 w-3.5" />
                          {account.tenantName}
                        </p>
                      </div>
                      <Button
                        isDisabled={isPending}
                        size="sm"
                        variant="danger"
                        onPress={() => deleteOwnerAccount(account)}
                      >
                        Verwijderen
                      </Button>
                    </div>

                    <form className="grid gap-3 md:grid-cols-[1fr_1fr_150px_auto]" onSubmit={updateOwnerAccount}>
                      <input name="tenantId" type="hidden" value={account.tenantId} />
                      <input name="userId" type="hidden" value={account.id} />
                      <input name="expectedUpdatedAt" type="hidden" value={account.updatedAt} />
                      <div className="field-stack">
                        <Label>Naam</Label>
                        <Input fullWidth name="displayName" defaultValue={account.displayName} required />
                      </div>
                      <div className="field-stack">
                        <Label>E-mail</Label>
                        <Input fullWidth name="email" defaultValue={account.email} required type="email" />
                      </div>
                      <label className="field-stack">
                        <span className="text-sm font-medium">Status</span>
                        <select
                          className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                          name="status"
                          defaultValue={account.status}
                        >
                          <option value="active">Actief</option>
                          <option value="archived">Gearchiveerd</option>
                        </select>
                      </label>
                      <div className="flex items-end">
                        <Button isDisabled={isPending} type="submit" variant="outline">
                          Opslaan
                        </Button>
                      </div>
                    </form>
                  </Card.Content>
                </Card>
              ))}
            </div>
          </div>
        </PageSection>
      ) : null}

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
