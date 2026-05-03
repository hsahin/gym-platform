"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, Chip } from "@heroui/react";
import { AppLayout } from "@heroui-pro/react/app-layout";
import { Navbar } from "@heroui-pro/react/navbar";
import { Sidebar } from "@heroui-pro/react/sidebar";
import { Button } from "@/components/dashboard/HydrationSafeButton";
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
import { FunctionalitySearch } from "@/components/FunctionalitySearch";
import { GymDashboard } from "@/components/GymDashboard";
import { LazyThemeModeSwitch } from "@/components/theme/LazyThemeModeSwitch";
import type { DashboardPageKey } from "@/lib/dashboard-pages";
import { getVisibleFunctionalitySearchEntries } from "@/lib/functionality-search";
import type { GymDashboardSnapshot } from "@/server/types";

const pageCopy: Record<
  DashboardPageKey,
  { title: string; description: string; ctaLabel?: string; ctaHref?: string }
> = {
  overview: {
    title: "Overzicht",
    description: "Leden, reserveringen, omzetgereedheid en inrichtingsstatus in één beeld.",
    ctaLabel: "Open reserveringen",
    ctaHref: "/reserve",
  },
  classes: {
    title: "Lessen",
    description: "Plan lessen, beheer reserveringen en registreer aanwezigheid.",
  },
  members: {
    title: "Leden",
    description: "Lidcyclus, toestemmingen en operationele context per club.",
  },
  contracts: {
    title: "Contracten",
    description: "Lidmaatschappen, prijzen en import in één beheerlaag.",
  },
  coaching: {
    title: "Coaching",
    description: "Trainingsschema's, voeding, voortgang en verdiepende coachmomenten.",
  },
  retention: {
    title: "Retentie",
    description: "Community, beloningen, vragenlijsten en loyale ledenroutes.",
  },
  access: {
    title: "Toegang",
    description: "Toegang op afstand, deurkoppelingen en beheerdersacties.",
  },
  payments: {
    title: "Betalingen",
    description: "Betaalprofiel, actieve betaalroutes en de huidige verwerkingsstatus.",
  },
  mobile: {
    title: "Mobiele app",
    description: "Merkapp, aankomstregistratie en ledenervaring voor mobiel gebruik.",
  },
  marketing: {
    title: "Marketing",
    description: "E-mail, promoties, leads en conversiesignalen uit actuele clubdata.",
  },
  integrations: {
    title: "Integraties",
    description: "Apparaten, software, meetapparatuur en migratiekoppelingen rondom je gym.",
  },
  settings: {
    title: "Gym instellingen",
    description: "Vestigingen, medewerkers, juridische status en systeemstatus.",
  },
  superadmin: {
    title: "Superadmin",
    description: "Beheer eigenaarsaccounts en clubmodules centraal.",
  },
};

const navigationItems = [
  { key: "overview", label: "Overzicht", href: "/dashboard", icon: LayoutDashboard },
  { key: "classes", label: "Lessen", href: "/dashboard/classes", icon: CalendarDays },
  { key: "members", label: "Leden", href: "/dashboard/members", icon: Users },
  { key: "contracts", label: "Contracten", href: "/dashboard/contracts", icon: WalletCards },
  { key: "coaching", label: "Coaching", href: "/dashboard/coaching", icon: Dumbbell },
  { key: "retention", label: "Retentie", href: "/dashboard/retention", icon: HeartHandshake },
  { key: "access", label: "Toegang", href: "/dashboard/access", icon: DoorOpen },
  { key: "payments", label: "Betalingen", href: "/dashboard/payments", icon: CreditCard },
  { key: "mobile", label: "Mobiele app", href: "/dashboard/mobile", icon: AppWindow },
  { key: "marketing", label: "Marketing", href: "/dashboard/marketing", icon: Megaphone },
  { key: "integrations", label: "Integraties", href: "/dashboard/integrations", icon: Link2 },
  { key: "settings", label: "Gym instellingen", href: "/dashboard/settings", icon: Settings },
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
    (item) => item.key !== "superadmin" || snapshot.uiCapabilities.canManageOwnerAccounts,
  );
  const visibleFunctionalitySearchEntries = getVisibleFunctionalitySearchEntries({
    canManageFeatureFlags: snapshot.uiCapabilities.canManageFeatureFlags,
    canManageOwnerAccounts: snapshot.uiCapabilities.canManageOwnerAccounts,
  });

  return (
    <AppLayout
      className="min-h-screen min-w-0 overflow-x-clip bg-background"
      navbar={
        <Navbar
          className="border-b border-border/80 bg-background/88 backdrop-blur"
          maxWidth="full"
        >
          <Navbar.Header className="px-3 py-3 sm:px-4 lg:px-6">
            <div className="flex w-full min-w-0 max-w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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

              <FunctionalitySearch
                ariaLabel="Functionaliteit zoeken"
                entries={visibleFunctionalitySearchEntries}
                placeholder="Zoek functionaliteit"
                tenantId={tenantId}
              />

              <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 sm:justify-end lg:shrink-0">
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
                <p className="text-muted text-xs">Werkruimte voor dagelijkse operatie</p>
              </div>
            </Link>
          </Sidebar.Header>

          <Sidebar.Content>
            <Sidebar.Group>
              <Sidebar.Menu aria-label="Dashboardnavigatie">
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
      <main className="app-page section-stack min-w-0 max-w-full overflow-x-clip py-6 md:py-8">
        <header className="grid min-w-0 max-w-full gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
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
