"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, Button, Chip } from "@heroui/react";
import { AppLayout } from "@heroui-pro/react/app-layout";
import { Navbar } from "@heroui-pro/react/navbar";
import { Sidebar } from "@heroui-pro/react/sidebar";
import {
  AppWindow,
  Dumbbell,
  CalendarDays,
  Cog,
  CreditCard,
  DoorOpen,
  HeartHandshake,
  Link2,
  LayoutDashboard,
  Megaphone,
  Settings,
  Users,
  WalletCards,
} from "lucide-react";
import { GymDashboard } from "@/components/GymDashboard";
import { LazyThemeModeSwitch } from "@/components/theme/LazyThemeModeSwitch";
import type { DashboardPageKey } from "@/lib/dashboard-pages";
import type { GymDashboardSnapshot } from "@/server/types";

const pageCopy: Record<
  DashboardPageKey,
  { title: string; description: string; ctaLabel?: string; ctaHref?: string }
> = {
  overview: {
    title: "Overview",
    description: "Members, bookings, revenue readiness, and setup state in one view.",
    ctaLabel: "Public booking",
    ctaHref: "/reserve",
  },
  classes: {
    title: "Classes",
    description: "Schedule sessions, manage bookings, and record attendance.",
  },
  members: {
    title: "Members",
    description: "Member lifecycle, waivers, and operational context.",
  },
  contracts: {
    title: "Contracts",
    description: "Membership plans, pricing, and imports.",
  },
  coaching: {
    title: "Coaching",
    description: "Workout plans, nutrition, progress tracking, and premium coach journeys.",
  },
  retention: {
    title: "Retention",
    description: "Community, rewards, questionnaires, and member loyalty programs.",
  },
  access: {
    title: "Access",
    description: "Remote access state, device mapping, and owner actions.",
  },
  payments: {
    title: "Payments",
    description: "Billing profile, enabled payment flows, and preview state.",
  },
  mobile: {
    title: "Mobile",
    description: "White-label app flows, check-in, and mobile-ready member experiences.",
  },
  marketing: {
    title: "Marketing Tools",
    description: "Email, promotions, leads, and conversion signals anchored in live gym data.",
  },
  integrations: {
    title: "Integrations",
    description: "Hardware, software, equipment, and migration bridges around the gym stack.",
  },
  settings: {
    title: "Settings",
    description: "Locations, staff, legal state, and runtime health.",
  },
  superadmin: {
    title: "Superadmin",
    description: "Toggle tenant-level feature flags and control module rollout from one place.",
  },
};

const navigationItems = [
  { key: "overview", label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { key: "classes", label: "Classes", href: "/dashboard/classes", icon: CalendarDays },
  { key: "members", label: "Members", href: "/dashboard/members", icon: Users },
  { key: "contracts", label: "Contracts", href: "/dashboard/contracts", icon: WalletCards },
  { key: "coaching", label: "Coaching", href: "/dashboard/coaching", icon: Dumbbell },
  { key: "retention", label: "Retention", href: "/dashboard/retention", icon: HeartHandshake },
  { key: "access", label: "Access", href: "/dashboard/access", icon: DoorOpen },
  { key: "payments", label: "Payments", href: "/dashboard/payments", icon: CreditCard },
  { key: "mobile", label: "Mobile", href: "/dashboard/mobile", icon: AppWindow },
  { key: "marketing", label: "Marketing", href: "/dashboard/marketing", icon: Megaphone },
  { key: "integrations", label: "Integrations", href: "/dashboard/integrations", icon: Link2 },
  { key: "settings", label: "Settings", href: "/dashboard/settings", icon: Settings },
  { key: "superadmin", label: "Superadmin", href: "/dashboard/superadmin", icon: Cog },
] satisfies ReadonlyArray<{
  key: DashboardPageKey;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}>;

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function GymDashboardClientShell({
  currentPage,
  roleLabel,
  snapshot,
  tenantId,
}: {
  readonly currentPage: DashboardPageKey;
  readonly roleLabel: string;
  readonly snapshot: GymDashboardSnapshot;
  readonly tenantId: string;
}) {
  const router = useRouter();
  const copy = pageCopy[currentPage];
  const actorInitials = initials(snapshot.actorName) || "GO";
  const ctaHref =
    copy.ctaHref === "/reserve" ? `/reserve?gym=${tenantId}` : copy.ctaHref;
  const visibleNavigationItems = navigationItems.filter(
    (item) => item.key !== "superadmin" || snapshot.uiCapabilities.canManageFeatureFlags,
  );

  return (
    <AppLayout
      className="min-h-screen bg-background"
      navbar={
        <Navbar
          className="border-b border-border/80 bg-background/88 backdrop-blur"
          maxWidth="full"
        >
          <Navbar.Header className="px-4 py-3 lg:px-6">
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <AppLayout.MenuToggle />
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Chip size="sm" variant="soft">
                    {snapshot.tenantName}
                  </Chip>
                  <Chip
                    size="sm"
                    variant="tertiary"
                    className="hidden sm:inline-flex"
                  >
                    {roleLabel}
                  </Chip>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {ctaHref && copy.ctaLabel ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => router.push(ctaHref)}
                  >
                    {copy.ctaLabel}
                  </Button>
                ) : null}
                <LazyThemeModeSwitch />
                <form action="/api/auth/logout" method="post">
                  <Button size="sm" type="submit" variant="outline">
                    Uitloggen
                  </Button>
                </form>
              </div>
            </div>
          </Navbar.Header>
        </Navbar>
      }
      sidebar={
        <Sidebar className="border-r border-border/70 bg-background">
          <Sidebar.Header className="px-4 py-5">
            <Link href="/" className="flex items-center gap-3">
              <div className="app-surface flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold shadow-none">
                G
              </div>
              <div>
                <p className="font-semibold">GymOS</p>
                <p className="text-muted text-xs">Operational workspace</p>
              </div>
            </Link>
          </Sidebar.Header>

          <Sidebar.Content>
            <Sidebar.Group>
              <Sidebar.Menu aria-label="Dashboard navigation">
                {visibleNavigationItems.map((item) => (
                  <Sidebar.MenuItem
                    key={item.key}
                    href={item.href}
                    isCurrent={item.key === currentPage}
                    className="rounded-2xl"
                  >
                    <Sidebar.MenuIcon>
                      <item.icon className="h-4 w-4" />
                    </Sidebar.MenuIcon>
                    <Sidebar.MenuLabel>{item.label}</Sidebar.MenuLabel>
                  </Sidebar.MenuItem>
                ))}
              </Sidebar.Menu>
            </Sidebar.Group>
          </Sidebar.Content>

          <Sidebar.Footer className="space-y-3 px-4 py-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <Avatar.Fallback>{actorInitials}</Avatar.Fallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{snapshot.actorName}</p>
                <p className="text-muted truncate text-xs">
                  {snapshot.actorEmail ?? roleLabel}
                </p>
              </div>
            </div>
          </Sidebar.Footer>
        </Sidebar>
      }
    >
      <main className="app-page section-stack py-6 md:py-8">
        <header className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div className="min-w-0 space-y-3">
            <Chip size="sm" variant="tertiary" className="w-fit sm:hidden">
              {roleLabel}
            </Chip>
            <div className="space-y-1.5">
              <h1 className="text-3xl font-semibold leading-tight md:text-[2.1rem]">
                {copy.title}
              </h1>
              <p className="text-muted max-w-3xl text-sm leading-6">
                {copy.description}
              </p>
            </div>
          </div>
        </header>
        <GymDashboard currentPage={currentPage} snapshot={snapshot} />
      </main>
    </AppLayout>
  );
}
