"use client";

import { CreditCard } from "lucide-react";
import { Card, Chip } from "@heroui/react";
import { LazyPlatformWorkbench } from "@/components/dashboard/LazyPlatformWorkbench";
import { PageSection, type DashboardPageProps } from "@/components/dashboard/shared";

export function PaymentsDashboardPage({ snapshot }: DashboardPageProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
      <PageSection
        title="Payments"
        description="Billing profile, enabled flows, and settlement state."
      >
        <div className="grid gap-4">
          <Card className="rounded-2xl border-border/80 bg-surface-secondary">
            <Card.Content className="space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <p className="font-medium">{snapshot.payments.profileLabel}</p>
              </div>
              <p className="text-muted text-sm">{snapshot.payments.helpText}</p>
              <div className="flex flex-wrap gap-2">
                <Chip size="sm" variant="soft">
                  {snapshot.payments.statusLabel}
                </Chip>
                {snapshot.payments.paymentMethods.map((method) => (
                  <Chip key={method} size="sm" variant="tertiary">
                    {method}
                  </Chip>
                ))}
              </div>
            </Card.Content>
          </Card>

          <Card className="rounded-2xl border-border/80 bg-surface-secondary">
            <Card.Content className="space-y-2">
              <p className="text-muted text-sm">Support</p>
              <p className="font-medium">{snapshot.payments.supportEmail}</p>
              <p className="text-muted text-sm">
                {snapshot.payments.settlementLabel} · {snapshot.payments.profileId}
              </p>
            </Card.Content>
          </Card>
        </div>
      </PageSection>

      <LazyPlatformWorkbench sections={["payments"]} showLaunchHeader={false} snapshot={snapshot} />
    </div>
  );
}
