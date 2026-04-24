"use client";

import { useState, type JSX } from "react";
import Link from "next/link";
import type { DashboardPageKey } from "@/lib/dashboard-pages";

type IconProps = { className?: string };

function DumbbellIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.4 14.4 9.6 9.6" />
      <path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z" />
      <path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z" />
    </svg>
  );
}

function ChartIcon(props: IconProps) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="16" />
    </svg>
  );
}

function CalendarIcon(props: IconProps) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function UsersIcon(props: IconProps) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    </svg>
  );
}

function FileIcon(props: IconProps) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" x2="8" y1="13" y2="13" />
    </svg>
  );
}

function LockIcon(props: IconProps) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CardIcon(props: IconProps) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}

function MegaphoneIcon(props: IconProps) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 11 18-5v12L3 13v-2z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}

function SettingsIcon(props: IconProps) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 10v6M4.2 4.2l4.2 4.2m7.2 7.2 4.2 4.2M1 12h6m10 0h6M4.2 19.8l4.2-4.2m7.2-7.2 4.2-4.2" />
    </svg>
  );
}

function MenuIcon(props: IconProps) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function XIcon(props: IconProps) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" x2="6" y1="6" y2="18" />
      <line x1="6" x2="18" y1="6" y2="18" />
    </svg>
  );
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", key: "overview", icon: ChartIcon },
  { href: "/dashboard/classes", label: "Classes", key: "classes", icon: CalendarIcon },
  { href: "/dashboard/members", label: "Members", key: "members", icon: UsersIcon },
  { href: "/dashboard/contracts", label: "Contracts", key: "contracts", icon: FileIcon },
  { href: "/dashboard/access", label: "Access Control", key: "access", icon: LockIcon },
  { href: "/dashboard/payments", label: "Payments", key: "payments", icon: CardIcon },
  { href: "/dashboard/marketing", label: "Marketing", key: "marketing", icon: MegaphoneIcon },
  { href: "/dashboard/settings", label: "Settings", key: "settings", icon: SettingsIcon },
] satisfies ReadonlyArray<{
  href: string;
  label: string;
  key: DashboardPageKey;
  icon: (props: IconProps) => JSX.Element;
}>;

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function NavLinks({
  currentPage,
  close,
}: {
  currentPage: DashboardPageKey;
  close?: () => void;
}) {
  return (
    <>
      {navItems.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          onClick={close}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
            currentPage === item.key
              ? "bg-white/[0.06] text-white"
              : "text-white/50 hover:bg-white/[0.03] hover:text-white"
          }`}
        >
          <item.icon className="h-5 w-5" />
          <span className="text-sm font-medium">{item.label}</span>
        </Link>
      ))}
    </>
  );
}

export function GymOsNavigation({
  currentPage,
  tenantName,
  actorName,
  roleLabel,
}: {
  currentPage: DashboardPageKey;
  tenantName: string;
  actorName: string;
  roleLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const actorInitials = initials(actorName) || "GO";

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[260px] flex-col border-r border-white/[0.06] bg-[#0a0a0a] lg:flex">
        <div className="border-b border-white/[0.06] p-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/20">
              <DumbbellIcon className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              Gym<span className="text-orange-500">OS</span>
            </span>
          </Link>
        </div>

        <div className="border-b border-white/[0.06] p-4">
          <div className="glass-card p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
                <DumbbellIcon className="h-4 w-4 text-orange-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{tenantName}</p>
                <p className="text-xs text-white/40">Live gym workspace</p>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          <NavLinks currentPage={currentPage} />
        </nav>

        <div className="border-t border-white/[0.06] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/20 text-sm font-semibold text-orange-300">
              {actorInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{actorName}</p>
              <p className="text-xs text-white/40">{roleLabel}</p>
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-lg p-2 text-white/40 transition hover:bg-white/[0.05] hover:text-white"
                aria-label="Uitloggen"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/90 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500">
              <DumbbellIcon className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              Gym<span className="text-orange-500">OS</span>
            </span>
          </Link>
          <button
            onClick={() => setIsOpen((value) => !value)}
            className="rounded-xl p-2 text-white transition hover:bg-white/[0.05]"
            aria-label="Menu openen"
          >
            {isOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isOpen ? (
        <button
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-label="Menu sluiten"
        />
      ) : null}

      <div
        className={`fixed inset-x-0 top-[57px] z-50 border-b border-white/[0.06] bg-[#0a0a0a] transition-transform duration-300 lg:hidden ${
          isOpen
            ? "pointer-events-auto translate-y-0"
            : "pointer-events-none -translate-y-full"
        }`}
      >
        <nav className="max-h-[calc(100vh-120px)] space-y-1 overflow-y-auto p-4">
          <NavLinks currentPage={currentPage} close={() => setIsOpen(false)} />
        </nav>
        <div className="border-t border-white/[0.06] p-4">
          <div className="flex items-center gap-3 px-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/20 text-sm font-semibold text-orange-300">
              {actorInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{actorName}</p>
              <p className="text-xs text-white/40">{roleLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
