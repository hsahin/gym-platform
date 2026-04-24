import { formatPhoneForDisplay } from "@claimtech/i18n";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/HeroCompat";
import { getMembershipBillingCycleLabel } from "@/lib/memberships";
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
    <Card className="overflow-hidden border-white/70 bg-white/90 shadow-[0_22px_80px_-58px_rgba(16,24,38,0.5)]">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Member profile</p>
            <CardTitle className="text-lg">{member.fullName}</CardTitle>
            <p className="mt-1 text-sm text-slate-600">{member.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusVariant}>{member.status}</Badge>
            <Badge
              variant={member.waiverStatus === "complete" ? "success" : "warning"}
            >
              waiver {member.waiverStatus}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-600">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="soft-card p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Plan
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {plan?.name ?? "Onbekend"}
            </p>
            {plan ? (
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                {getMembershipBillingCycleLabel(plan.billingCycle)}
              </p>
            ) : null}
          </div>
          <div className="soft-card p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Locatie
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {homeLocationName ?? "Onbekend"}
            </p>
          </div>
          <div className="soft-card p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Volgende incasso
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {formatRenewalDate(member.nextRenewalAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-slate-700">
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
