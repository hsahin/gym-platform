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
  lines = 1,
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
      <Tooltip.Content className="bg-overlay text-foreground border-border max-w-xs rounded-lg border px-3 py-2 text-xs leading-5 shadow-overlay">
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
  scopedTenantId,
}: {
  readonly features: ReadonlyArray<FeatureState>;
  readonly editable?: boolean;
  readonly currentPage?: DashboardPageKey;
  readonly snapshot?: GymDashboardSnapshot;
  /** When set, the feature-flag mutation targets this tenant explicitly.
   *  Only honoured server-side when the viewer is a superadmin. */
  readonly scopedTenantId?: string;
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
      layout={editable ? "grid" : "list"}
      variant="outline"
      className="mobile-feature-module-board min-w-0 max-w-full"
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
        const stateLabel = getDashboardFeatureFlagStateLabel(feature.enabled);
        const metadataLabel = [
          getDashboardFeatureCategoryLabel(feature),
          getDashboardFeatureStatusLabel(feature.statusLabel),
          getDashboardFeatureReasonLabel(feature.reason),
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <ItemCard
            key={feature.key}
            className={`min-h-0 min-w-0 max-w-full flex-wrap items-center gap-3 ${
              feature.enabled ? "" : "opacity-80"
            }`}
          >
            <ItemCard.Icon
              aria-label={stateLabel}
              className={
                feature.enabled
                  ? "size-7 bg-success/15 text-success"
                  : "bg-muted/15 text-muted size-7"
              }
            >
              <span aria-hidden="true" className="size-2 rounded-full bg-current" />
            </ItemCard.Icon>
            <ItemCard.Content className="min-w-0 flex-1 gap-0.5">
              <ItemCard.Title className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                <TruncatedTooltipText
                  className="max-w-full"
                  lines={1}
                  text={featureCopy.title}
                />
                {feature.badgeLabel ? (
                  <Chip color="accent" size="sm" variant="soft">
                    {feature.badgeLabel}
                  </Chip>
                ) : null}
              </ItemCard.Title>
              <div className="text-muted min-w-0 text-xs leading-5">
                <TruncatedTooltipText text={featureCopy.description} />
              </div>
              {presenceSummary ? (
                <div className="text-muted/80 min-w-0 text-[0.7rem] leading-4">
                  <TruncatedTooltipText text={presenceSummary} />
                </div>
              ) : null}
              {metadataLabel ? (
                <div className="text-muted/70 min-w-0 text-[0.65rem] uppercase tracking-[0.08em]">
                  <TruncatedTooltipText text={metadataLabel} />
                </div>
              ) : null}
            </ItemCard.Content>
            <ItemCard.Action className="flex shrink-0 items-center gap-2">
              <Chip
                color={feature.enabled ? "success" : "default"}
                size="sm"
                variant={feature.enabled ? "soft" : "tertiary"}
              >
                {stateLabel}
              </Chip>
              {shouldShowOpenAction ? (
                <Link
                  href={targetHref}
                  prefetch={false}
                  className="border-border bg-surface text-foreground hover:border-accent hover:text-accent rounded-full border px-3 py-1 text-xs font-medium transition"
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
                          tenantId: scopedTenantId,
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
                </Switch>
              ) : null}
            </ItemCard.Action>
          </ItemCard>
        );
      })}
    </ItemCardGroup>
  );
}
