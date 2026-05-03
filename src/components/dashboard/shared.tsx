import type { ReactNode } from "react";
import { Card, Chip } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react/empty-state";
import type { GymDashboardSnapshot } from "@/server/types";

export type DashboardPageProps = {
  readonly snapshot: GymDashboardSnapshot;
};

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(value));
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(value));
}

export function statusChip(status: string) {
  if (
    ["active", "confirmed", "checked_in", "healthy", "configured", "signed"].includes(
      status,
    )
  ) {
    return { color: "success" as const, variant: "soft" as const };
  }

  if (["waitlisted", "trial", "attention", "requested", "expired"].includes(status)) {
    return { color: "warning" as const, variant: "soft" as const };
  }

  if (["paused", "cancelled", "archived"].includes(status)) {
    return { color: "default" as const, variant: "tertiary" as const };
  }

  return { color: "accent" as const, variant: "tertiary" as const };
}

export function PageSection({
  title,
  description,
  actions,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section className="grid min-w-0 max-w-full content-start gap-4 overflow-x-clip">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h2 className="text-xl font-semibold leading-tight">{title}</h2>
          {description ? (
            <p className="text-muted max-w-3xl text-sm leading-6">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="min-w-0 md:shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function EmptyPanel({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <EmptyState className="rounded-[28px] border border-border/80 bg-surface">
      <EmptyState.Header>
        <EmptyState.Title>{title}</EmptyState.Title>
      </EmptyState.Header>
      <EmptyState.Content>
        <EmptyState.Description>{description}</EmptyState.Description>
      </EmptyState.Content>
    </EmptyState>
  );
}

export function DisabledActionReason({ reason }: { readonly reason: string | null }) {
  if (!reason) {
    return null;
  }

  return (
    <p className="text-muted max-w-md text-sm leading-6" data-disabled-reason>
      {reason}
    </p>
  );
}

export function LoadingPanel({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <Card className="rounded-[28px] border border-border/80 bg-surface">
      <Card.Content className="space-y-2 py-8">
        <Chip size="sm" variant="tertiary">
          Laden
        </Chip>
        <p className="text-lg font-semibold">{title}</p>
        <p className="text-muted text-sm leading-6">{description}</p>
      </Card.Content>
    </Card>
  );
}
