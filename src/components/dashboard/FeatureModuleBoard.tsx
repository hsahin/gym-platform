"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Chip, Switch, Tooltip } from "@heroui/react";
import { ItemCard } from "@heroui-pro/react/item-card";
import { ItemCardGroup } from "@heroui-pro/react/item-card-group";
import { toast } from "sonner";
import { submitDashboardMutation } from "@/components/dashboard/dashboard-client-helpers";
import {
  getDashboardFeatureCategoryLabel,
  getDashboardFeatureFlagStateLabel,
  getDashboardFeatureReasonLabel,
  getDashboardFeatureStatusLabel,
  getDashboardFeatureUiCopy,
} from "@/features/dashboard-feature-copy";
import { buildFeaturePresenceSummary } from "@/features/dashboard-feature-presence";
import { getDashboardPageHref, type DashboardPageKey } from "@/lib/dashboard-pages";
import type { FeatureState, GymDashboardSnapshot } from "@/server/types";

function TruncatedTooltipText({
  text,
  className,
  lines = 2,
}: {
  readonly text: string;
  readonly className?: string;
  readonly lines?: 1 | 2;
}) {
  const lineClassName = lines === 1 ? "truncate" : "line-clamp-2";

  return (
    <Tooltip delay={350}>
      <Tooltip.Trigger>
        <span
          className={`block min-w-0 ${lineClassName} ${className ?? ""}`}
          tabIndex={0}
        >
          {text}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Content className="max-w-xs text-xs leading-5">
        <Tooltip.Arrow />
        {text}
      </Tooltip.Content>
    </Tooltip>
  );
}

export function FeatureModuleBoard({
  features,
  editable = false,
  currentPage,
  snapshot,
}: {
  readonly features: ReadonlyArray<FeatureState>;
  readonly editable?: boolean;
  readonly currentPage?: DashboardPageKey;
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
    <ItemCardGroup
      columns={editable ? 2 : 3}
      layout="grid"
      className="gap-2 rounded-[22px] border border-border/70 bg-surface-secondary/60 p-2"
    >
      {normalizedFeatures.map((feature) => {
        const isSaving = isPending && pendingKey === feature.key;
        const featureCopy = getDashboardFeatureUiCopy(feature);
        const targetPage = feature.dashboardPage as DashboardPageKey;
        const targetHref = getDashboardPageHref(targetPage);
        const shouldShowOpenAction = currentPage !== targetPage;
        const presenceSummary = snapshot
          ? buildFeaturePresenceSummary(feature, snapshot)
          : null;

        return (
          <ItemCard
            key={feature.key}
            variant="outline"
            className={`min-h-0 items-start gap-3 rounded-2xl bg-surface px-3 py-3 shadow-none ${
              feature.enabled ? "" : "opacity-85"
            }`}
          >
            <ItemCard.Icon
              className={
                feature.enabled
                  ? "size-8 bg-success/10 text-success"
                  : "size-8 bg-surface-secondary text-muted"
              }
            >
              <span className="size-2 rounded-full bg-current" />
            </ItemCard.Icon>
            <ItemCard.Content className="min-w-0 gap-1">
              <ItemCard.Title className="flex flex-wrap items-center gap-1.5 text-sm">
                <TruncatedTooltipText
                  className="max-w-[12rem] font-semibold"
                  lines={1}
                  text={featureCopy.title}
                />
                <Chip
                  size="sm"
                  variant={feature.enabled ? "soft" : "tertiary"}
                  color={feature.enabled ? "success" : "default"}
                >
                  {getDashboardFeatureFlagStateLabel(feature.enabled)}
                </Chip>
                {feature.badgeLabel ? (
                  <Chip size="sm" color="accent" variant="soft">
                    {feature.badgeLabel}
                  </Chip>
                ) : null}
              </ItemCard.Title>
              <ItemCard.Description className="max-w-none text-xs leading-5">
                <TruncatedTooltipText text={featureCopy.description} />
              </ItemCard.Description>
              {presenceSummary ? (
                <p className="text-muted text-xs leading-5">
                  <TruncatedTooltipText text={presenceSummary} />
                </p>
              ) : null}
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <Chip size="sm" variant="tertiary">
                  {getDashboardFeatureCategoryLabel(feature)}
                </Chip>
                <Chip size="sm" variant="tertiary">
                  {getDashboardFeatureReasonLabel(feature.reason)}
                </Chip>
                <Chip size="sm" variant="tertiary">
                  {getDashboardFeatureStatusLabel(feature.statusLabel)}
                </Chip>
              </div>
            </ItemCard.Content>
            {shouldShowOpenAction || editable ? (
              <ItemCard.Action className="flex flex-col items-end gap-2">
                {shouldShowOpenAction ? (
                  <Link
                    href={targetHref}
                    prefetch={false}
                    className="whitespace-nowrap rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium"
                  >
                    Module openen
                  </Link>
                ) : null}

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
                          await submitDashboardMutation("/api/platform/feature-flags", {
                            key: feature.key,
                            enabled: nextValue,
                          });

                          toast.success(
                            `${featureCopy.title} ${nextValue ? "ingeschakeld" : "uitgeschakeld"}.`,
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
              </ItemCard.Action>
            ) : null}
          </ItemCard>
        );
      })}
    </ItemCardGroup>
  );
}
