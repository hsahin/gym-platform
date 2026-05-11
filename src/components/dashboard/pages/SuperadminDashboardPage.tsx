"use client";

import { useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CreditCard,
  Globe2,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { Card, Chip, Input, Label } from "@heroui/react";
import { toast } from "sonner";
import { Button } from "@/components/dashboard/HydrationSafeButton";
import { FeatureModuleBoard } from "@/components/dashboard/FeatureModuleBoard";
import {
  EmptyPanel,
  PageSection,
  type DashboardPageProps,
} from "@/components/dashboard/shared";
import { getDashboardFeatureCategoryLabel } from "@/features/dashboard-feature-copy";
import { getEntityStatusLabel } from "@/lib/ui-labels";
import { buildMutationHeaders } from "@/lib/mutation-security-client";
import type { FeatureState } from "@/server/types";

function formatEuroFromCents(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.round(value / 100));
}

function billingChipColor(status: string) {
  if (status === "configured") {
    return "success" as const;
  }
  if (status === "attention") {
    return "warning" as const;
  }
  return "default" as const;
}

function billingChipLabel(status: string) {
  if (status === "configured") {
    return "Mollie aan";
  }
  if (status === "attention") {
    return "Aandacht";
  }
  return "Geen Mollie";
}

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
      title: getDashboardFeatureCategoryLabel(feature),
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
    headers: await buildMutationHeaders(),
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as {
    ok: boolean;
    error?: { message: string };
  };

  if (!response.ok || !result.ok) {
    throw new Error(result.error?.message ?? "Eigenaarsaccount kon niet worden opgeslagen.");
  }
}

export function SuperadminDashboardPage({ snapshot, tenantId }: DashboardPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!snapshot.uiCapabilities.canManageOwnerAccounts) {
    return (
      <EmptyPanel
        title="Superadmin toegang vereist"
        description="Alleen superadmins zien dit platformoverzicht. Eigenaren beheren hun eigen gym vanuit de andere dashboardpagina's."
      />
    );
  }

  const groupedFeatures = groupFeaturesByCategory(snapshot.featureFlags);
  const ownerAccounts = snapshot.superadmin.ownerAccounts;
  const tenants = snapshot.superadmin.tenants;
  const totals = snapshot.superadmin.platformTotals;
  const tenantOptionsMap = new Map<string, { id: string; name: string }>();
  for (const tenant of tenants) {
    tenantOptionsMap.set(tenant.tenantId, {
      id: tenant.tenantId,
      name: tenant.tenantName,
    });
  }
  for (const account of ownerAccounts) {
    if (!tenantOptionsMap.has(account.tenantId)) {
      tenantOptionsMap.set(account.tenantId, {
        id: account.tenantId,
        name: account.tenantName,
      });
    }
  }
  const tenantOptions = [...tenantOptionsMap.values()];
  const activeTenantName =
    tenantOptions.find((tenant) => tenant.id === tenantId)?.name ?? snapshot.tenantName;
  const activeTenantOverview = tenants.find(
    (tenant) => tenant.tenantId === tenantId,
  );

  function switchScopedTenant(nextTenantId: string) {
    const url = new URL(window.location.href);

    if (!nextTenantId || nextTenantId === tenantId) {
      return;
    }

    url.searchParams.set("asTenant", nextTenantId);
    router.push(`${url.pathname}${url.search}`);
  }

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
        toast.success("Eigenaarsaccount aangemaakt.");
        event.currentTarget.reset();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Eigenaarsaccount kon niet worden aangemaakt.");
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
        toast.success("Eigenaarsaccount bijgewerkt.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Eigenaarsaccount kon niet worden bijgewerkt.");
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
        toast.success("Eigenaarsaccount verwijderd.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Eigenaarsaccount kon niet worden verwijderd.");
      }
    });
  }

  const platformKpis = [
    {
      icon: Building2,
      label: "Gyms op het platform",
      value: String(snapshot.superadmin.tenantsCount),
      helper: `${totals.locationCount} vestiging${totals.locationCount === 1 ? "" : "en"} actief.`,
    },
    {
      icon: Users,
      label: "Leden totaal",
      value: String(totals.memberCount),
      helper: `${totals.activeMemberCount} actief · ${totals.trialMemberCount} proef.`,
    },
    {
      icon: CreditCard,
      label: "Maandomzet",
      value: formatEuroFromCents(totals.monthlyRevenueCents),
      helper: `${totals.billingConfiguredCount}/${snapshot.superadmin.tenantsCount} gyms met Mollie aan.`,
    },
    {
      icon: ShieldCheck,
      label: "Eigenaarsaccounts",
      value: String(snapshot.superadmin.activeOwnerAccounts),
      helper: `${snapshot.superadmin.archivedOwnerAccounts} gearchiveerd.`,
    },
    {
      icon: Globe2,
      label: "Live signup-flows",
      value: String(totals.publicSignupReadyCount),
      helper: "Gyms waar leden zich publiek kunnen aanmelden (Mollie + voorwaarden klaar).",
    },
    {
      icon: ShieldCheck,
      label: "Lessen platformbreed",
      value: String(totals.classSessionCount),
      helper: `${totals.remoteAccessConfiguredCount} gyms hebben slimme toegang gekoppeld.`,
    },
  ];

  return (
    <div className="section-stack">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {platformKpis.map((item) => (
          <Card
            key={item.label}
            className="border-border/80 bg-surface rounded-2xl border shadow-none"
          >
            <Card.Content className="space-y-2 p-5">
              <div className="text-muted flex items-center gap-2 text-sm">
                <item.icon className="size-4" aria-hidden="true" />
                <span>{item.label}</span>
              </div>
              <p className="text-foreground text-3xl font-semibold tabular-nums">
                {item.value}
              </p>
              <p className="text-muted text-sm leading-6">{item.helper}</p>
            </Card.Content>
          </Card>
        ))}
      </div>

      <PageSection
        title="Gyms op het platform"
        description="Overzicht van elke gym met leden, omzet en setup-status. Klik op een rij om die gym te beheren."
      >
        {tenants.length === 0 ? (
          <EmptyPanel
            title="Nog geen gyms"
            description="Voeg eerst een gym aan het platform toe om dit overzicht te vullen."
          />
        ) : (
          <Card className="border-border/80 bg-surface overflow-hidden rounded-2xl border shadow-none">
            <Card.Content className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-muted text-xs uppercase tracking-wide">
                    <tr className="border-border/60 border-b">
                      <th className="px-4 py-3 font-semibold">Gym</th>
                      <th className="px-4 py-3 font-semibold tabular-nums">Leden</th>
                      <th className="px-4 py-3 font-semibold tabular-nums">Omzet</th>
                      <th className="px-4 py-3 font-semibold">Mollie</th>
                      <th className="px-4 py-3 font-semibold">Publieke signup</th>
                      <th className="px-4 py-3 font-semibold">Eigenaar</th>
                      <th className="px-4 py-3 font-semibold text-right">Actie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((tenant) => {
                      const isActive = tenant.tenantId === tenantId;

                      return (
                        <tr
                          key={tenant.tenantId}
                          className={`border-border/40 hover:bg-surface-secondary border-b transition ${
                            isActive ? "bg-surface-secondary/60" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <p className="text-foreground font-semibold">
                              {tenant.tenantName}
                            </p>
                            <p className="text-muted text-xs">
                              {tenant.locationCount} vestiging
                              {tenant.locationCount === 1 ? "" : "en"} ·{" "}
                              {tenant.membershipPlanCount} contract
                              {tenant.membershipPlanCount === 1 ? "" : "en"} ·{" "}
                              {tenant.classSessionCount} lessen
                            </p>
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            <p className="text-foreground font-medium">
                              {tenant.memberCount}
                            </p>
                            <p className="text-muted text-xs">
                              {tenant.activeMemberCount} actief ·{" "}
                              {tenant.trialMemberCount} proef
                            </p>
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            <p className="text-foreground font-medium">
                              {formatEuroFromCents(tenant.monthlyRevenueCents)}
                            </p>
                            <p className="text-muted text-xs">per maand</p>
                          </td>
                          <td className="px-4 py-3">
                            <Chip
                              color={billingChipColor(tenant.billingStatus)}
                              size="sm"
                              variant="soft"
                            >
                              {billingChipLabel(tenant.billingStatus)}
                            </Chip>
                          </td>
                          <td className="px-4 py-3">
                            <Chip
                              color={tenant.publicSignupReady ? "success" : "default"}
                              size="sm"
                              variant={tenant.publicSignupReady ? "soft" : "tertiary"}
                            >
                              {tenant.publicSignupReady ? "Live" : "Nog niet"}
                            </Chip>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-foreground text-sm">
                              {tenant.ownerNames[0] ?? "—"}
                            </p>
                            {tenant.ownerNames.length > 1 ? (
                              <p className="text-muted text-xs">
                                +{tenant.ownerNames.length - 1} extra
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              isDisabled={isActive}
                              size="sm"
                              type="button"
                              variant={isActive ? "secondary" : "outline"}
                              onPress={() => switchScopedTenant(tenant.tenantId)}
                            >
                              {isActive ? "In beheer" : "Beheer"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card.Content>
          </Card>
        )}
      </PageSection>

      <PageSection
        title="Eigenaren"
        description="Beheer welke eigenaren toegang hebben tot hun gym. Platformbreed; los van clubmodules."
      >
        <div className="section-stack">
          <Card className="border-border/80 bg-surface rounded-2xl border shadow-none">
            <Card.Header className="space-y-2">
              <div className="flex items-center gap-2">
                <UserCog className="text-muted size-4" aria-hidden="true" />
                <Card.Title>Nieuwe eigenaar toevoegen</Card.Title>
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
                    className="border-border bg-surface h-10 rounded-xl border px-3 text-sm"
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
                  <Label>Naam eigenaar</Label>
                  <Input fullWidth name="displayName" placeholder="Naam eigenaar" required />
                </div>
                <div className="field-stack">
                  <Label>E-mail</Label>
                  <Input fullWidth name="email" placeholder="eigenaar@gym.nl" required type="email" />
                </div>
                <div className="field-stack">
                  <Label>Tijdelijk wachtwoord</Label>
                  <Input fullWidth name="password" minLength={8} required type="password" />
                </div>
                <Button isDisabled={isPending} type="submit" variant="primary">
                  Eigenaarsaccount aanmaken
                </Button>
              </form>
            </Card.Content>
          </Card>

          <div className="grid gap-3">
            {ownerAccounts.map((account) => (
              <Card
                key={account.id}
                className="border-border/80 bg-surface rounded-2xl border shadow-none"
              >
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
                          {getEntityStatusLabel(account.status)}
                        </Chip>
                      </div>
                      <p className="text-muted text-sm">{account.email}</p>
                      <p className="text-muted flex items-center gap-1 text-sm">
                        <Building2 className="size-3.5" aria-hidden="true" />
                        {account.tenantName}
                      </p>
                    </div>
                    <Button
                      isDisabled={isPending}
                      size="sm"
                      variant="danger-soft"
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
                        className="border-border bg-surface h-10 rounded-xl border px-3 text-sm"
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

      <PageSection
        title={`Modules · ${activeTenantName}`}
        description="Schakel modules voor de geselecteerde gym aan of uit. Andere gyms blijven onaangetast."
      >
        <Card className="border-border/80 bg-surface rounded-2xl border shadow-none">
          <Card.Content className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="field-stack">
              <span className="text-sm font-medium">Gym in beheer</span>
              <select
                aria-label="Gym kiezen om modules voor te beheren"
                className="border-border bg-surface h-10 rounded-xl border px-3 text-sm"
                value={tenantId}
                onChange={(event) => switchScopedTenant(event.target.value)}
              >
                {tenantOptions.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </label>
            {activeTenantOverview ? (
              <p className="text-muted text-sm">
                {activeTenantOverview.memberCount} leden ·{" "}
                {formatEuroFromCents(activeTenantOverview.monthlyRevenueCents)} omzet ·{" "}
                {activeTenantOverview.classSessionCount} lessen.
              </p>
            ) : null}
          </Card.Content>
        </Card>
      </PageSection>

      {groupedFeatures.map((group) => (
        <PageSection
          key={group.title}
          title={`${group.title} · ${activeTenantName}`}
          description="Schakel modules per club in of uit zonder verborgen configuraties."
        >
          <FeatureModuleBoard
            currentPage="superadmin"
            editable
            features={group.features}
            scopedTenantId={tenantId}
            snapshot={snapshot}
          />
        </PageSection>
      ))}
    </div>
  );
}
