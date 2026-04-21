export type PlatformRoleKey = "owner" | "manager" | "trainer" | "frontdesk";

type BadgeVariant = "success" | "info" | "warning" | "secondary";

export const PLATFORM_ROLE_OPTIONS: ReadonlyArray<{
  key: PlatformRoleKey;
  label: string;
  scopeLabel: string;
  badgeVariant: BadgeVariant;
  description: string;
  highlights: ReadonlyArray<string>;
}> = [
  {
    key: "owner",
    label: "Eigenaar",
    scopeLabel: "volledig beheer",
    badgeVariant: "success",
    description:
      "Voor overzicht over omzet, vestigingen, teambeheer en platforminstellingen.",
    highlights: [
      "Vestigingen, trainers en lessen beheren",
      "Leden en memberships inrichten",
      "Teamaccounts en platforminstellingen beheren",
    ],
  },
  {
    key: "manager",
    label: "Operations manager",
    scopeLabel: "dagelijkse operatie",
    badgeVariant: "info",
    description:
      "Voor front-of-house, roosters en operationeel overzicht over meerdere locaties.",
    highlights: [
      "Leden en boekingen beheren",
      "Check-ins verwerken",
      "Gezondheid en audit van de tenant volgen",
    ],
  },
  {
    key: "trainer",
    label: "Trainer",
    scopeLabel: "coach workflow",
    badgeVariant: "warning",
    description:
      "Voor coaches die klassen, aanwezigheid en ledencontext nodig hebben.",
    highlights: [
      "Lesrooster bekijken",
      "Attendance markeren",
      "Ledenstatus per sessie zien",
    ],
  },
  {
    key: "frontdesk",
    label: "Frontdesk",
    scopeLabel: "balie flow",
    badgeVariant: "secondary",
    description:
      "Voor trialboekingen, waivers en contact-updates aan de receptie.",
    highlights: [
      "Trial- en class-bookings aanmaken",
      "Waiverstatus bekijken",
      "Basisledenoverzicht raadplegen",
    ],
  },
] as const;

const roleToMembershipRole: Record<PlatformRoleKey, string> = {
  owner: "gym.owner",
  manager: "gym.manager",
  trainer: "gym.trainer",
  frontdesk: "gym.frontdesk",
};

const membershipRoleToRoleKey = new Map(
  Object.entries(roleToMembershipRole).map(([roleKey, membershipRole]) => [
    membershipRole,
    roleKey as PlatformRoleKey,
  ]),
);

export function getRoleLabel(roleKey: PlatformRoleKey) {
  return PLATFORM_ROLE_OPTIONS.find((role) => role.key === roleKey)?.label ?? roleKey;
}

export function getMembershipRole(roleKey: PlatformRoleKey) {
  return roleToMembershipRole[roleKey];
}

export function getRoleKeyFromMembershipRole(membershipRole: string) {
  return membershipRoleToRoleKey.get(membershipRole) ?? null;
}
