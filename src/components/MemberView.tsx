import { formatPhoneForDisplay } from "@claimtech/i18n";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/HeroCompat";
import { getMembershipBillingCycleLabel } from "@/lib/memberships";
import {
  getMemberStatusLabel,
  getWaiverStatusLabel,
} from "@/lib/ui-labels";
import type { GymMember, MembershipPlan } from "@/server/types";

function formatRenewalDate(nextRenewalAt: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(nextRenewalAt));
}

export function MemberView({
  member,
  plan,
  homeLocationName,
}: {
  member: GymMember;
  plan?: MembershipPlan;
  homeLocationName?: string;
}) {
  const statusVariant =
    member.status === "active"
      ? "success"
      : member.status === "trial"
        ? "warning"
        : "secondary";
  const visibleTags = member.tags.slice(0, 3);
  const hiddenTagCount = Math.max(member.tags.length - visibleTags.length, 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Lidprofiel</p>
            <CardTitle className="text-lg">{member.fullName}</CardTitle>
            <p className="text-muted mt-1 break-all text-sm">{member.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusVariant}>{getMemberStatusLabel(member.status)}</Badge>
            <Badge
              variant={member.waiverStatus === "complete" ? "success" : "warning"}
            >
              {getWaiverStatusLabel(member.waiverStatus)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="text-muted space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="soft-card">
            <p className="eyebrow">Plan</p>
            <p className="text-foreground text-base font-semibold">
              {plan?.name ?? "Onbekend"}
            </p>
            {plan ? (
              <p className="eyebrow">
                {getMembershipBillingCycleLabel(plan.billingCycle)}
              </p>
            ) : null}
          </div>
          <div className="soft-card">
            <p className="eyebrow">Vestiging</p>
            <p className="text-foreground text-base font-semibold">
              {homeLocationName ?? "Onbekend"}
            </p>
          </div>
          <div className="soft-card">
            <p className="eyebrow">Volgende incasso</p>
            <p className="text-foreground text-base font-semibold tabular-nums">
              {formatRenewalDate(member.nextRenewalAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <p className="text-foreground text-sm font-medium">
            {formatPhoneForDisplay(member.phone, member.phoneCountry)}
          </p>
          {visibleTags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
          {hiddenTagCount > 0 ? (
            <Badge variant="outline">+{hiddenTagCount} extra</Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
