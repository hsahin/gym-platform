"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Chip, Switch } from "@heroui/react";
import { toast } from "sonner";
import { buildFeaturePresenceSummary } from "@/features/dashboard-feature-presence";
import { getDashboardPageHref, type DashboardPageKey } from "@/lib/dashboard-pages";
import { MUTATION_CSRF_TOKEN } from "@/server/http/platform-api";
import type { FeatureState, GymDashboardSnapshot } from "@/server/types";

function getReasonLabel(reason: string) {
  switch (reason) {
    case "tenant_override":
      return "Tenant override";
    case "actor_override":
      return "Actor override";
    case "rollout":
      return "Rollout";
    default:
      return "Default";
  }
}

export function FeatureModuleBoard({
  features,
  editable = false,
  snapshot,
}: {
  readonly features: ReadonlyArray<FeatureState>;
  readonly editable?: boolean;
  readonly snapshot?: GymDashboardSnapshot;
}) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [localState, setLocalState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(features.map((feature) => [feature.key, feature.enabled])),
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setLocalState(Object.fromEntries(features.map((feature) => [feature.key, feature.enabled])));
  }, [features]);

  const normalizedFeatures = useMemo(
    () =>
      features.map((feature) => ({
        ...feature,
        enabled: localState[feature.key] ?? feature.enabled,
      })),
    [features, localState],
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {normalizedFeatures.map((feature) => {
        const isSaving = isPending && pendingKey === feature.key;

        return (
          <Card
            key={feature.key}
            className={`rounded-[24px] border border-border/80 bg-surface shadow-none ${
              feature.enabled ? "" : "opacity-85"
            }`}
          >
            <Card.Header className="items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Card.Title className="text-lg">{feature.title}</Card.Title>
                  <Chip
                    size="sm"
                    variant={feature.enabled ? "soft" : "tertiary"}
                    color={feature.enabled ? "success" : "default"}
                  >
                    {feature.enabled ? "Enabled" : "Disabled"}
                  </Chip>
                  <Chip size="sm" variant="tertiary">
                    {feature.statusLabel}
                  </Chip>
                  {feature.badgeLabel ? (
                    <Chip size="sm" color="accent" variant="soft">
                      {feature.badgeLabel}
                    </Chip>
                  ) : null}
                </div>
                <Card.Description className="text-sm leading-6">
                  {feature.description}
                </Card.Description>
                {snapshot ? (
                  <p className="text-muted text-sm leading-6">
                    {buildFeaturePresenceSummary(feature, snapshot)}
                  </p>
                ) : null}
              </div>
            </Card.Header>

            <Card.Content className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Chip size="sm" variant="tertiary">
                  {feature.categoryTitle}
                </Chip>
                <Chip size="sm" variant="tertiary">
                  {getReasonLabel(feature.reason)}
                </Chip>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                  href={getDashboardPageHref(feature.dashboardPage as DashboardPageKey)}
                  prefetch={false}
                  className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium"
                >
                  Open module
                </Link>

                {editable ? (
                  <Switch
                    isDisabled={isSaving}
                    isSelected={feature.enabled}
                    onChange={(nextValue) => {
                      const previousValue = feature.enabled;
                      setLocalState((current) => ({
                        ...current,
                        [feature.key]: nextValue,
                      }));
                      setPendingKey(feature.key);

                      startTransition(async () => {
                        try {
                          const response = await fetch("/api/platform/feature-flags", {
                            method: "POST",
                            headers: {
                              "content-type": "application/json",
                              "x-claimtech-csrf": MUTATION_CSRF_TOKEN,
                              "x-idempotency-key": crypto.randomUUID(),
                            },
                            body: JSON.stringify({
                              key: feature.key,
                              enabled: nextValue,
                            }),
                          });

                          const payload = (await response.json()) as {
                            ok: boolean;
                            error?: { message: string };
                          };

                          if (!response.ok || !payload.ok) {
                            throw new Error(
                              payload.error?.message ?? "Feature flag kon niet worden bijgewerkt.",
                            );
                          }

                          toast.success(
                            `${feature.title} ${nextValue ? "ingeschakeld" : "uitgeschakeld"}.`,
                          );
                          router.refresh();
                        } catch (error) {
                          setLocalState((current) => ({
                            ...current,
                            [feature.key]: previousValue,
                          }));
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Feature flag kon niet worden bijgewerkt.",
                          );
                        } finally {
                          setPendingKey(null);
                        }
                      });
                    }}
                  >
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    <Switch.Content>
                      {isSaving ? "Opslaan..." : feature.enabled ? "Aan" : "Uit"}
                    </Switch.Content>
                  </Switch>
                ) : null}
              </div>
            </Card.Content>
          </Card>
        );
      })}
    </div>
  );
}
