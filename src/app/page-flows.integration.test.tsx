import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  viewer: null as null | {
    actor: { subjectId: string };
    roleKey: "member" | "owner";
    roleLabel: string;
  },
  isSetupComplete: true,
  serviceError: null as Error | null,
  publicReservationSnapshot: {
    tenantName: "Northside Athletics",
    classSessions: [],
  },
  publicMembershipSignupSnapshot: {
    tenantName: "Northside Athletics",
    membershipPlans: [],
  },
  memberReservationSnapshot: {
    tenantName: "Northside Athletics",
    classSessions: [],
  },
  getPublicReservationSnapshot: vi.fn(),
  getPublicMembershipSignupSnapshot: vi.fn(),
  getMemberReservationSnapshot: vi.fn(),
  resolveViewerFromToken: vi.fn(),
  hasLocalPlatformSetup: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const components = vi.hoisted(() => ({
  GymDashboardShell: vi.fn(() => null),
  LazyThemeModeSwitch: vi.fn(() => null),
  Link: vi.fn(() => null),
  LoginPageView: vi.fn(() => null),
  PublicLandingPage: vi.fn(() => null),
  PublicMembershipSignupPortal: vi.fn(() => null),
  PublicReservationPortal: vi.fn(() => null),
  RuntimeConfigurationState: vi.fn(() => null),
}));

type DashboardShellProps = {
  currentPage: string;
};

type LinkProps = {
  href: string;
};

type LoginViewProps = {
  isSetupComplete: boolean;
  loginError?: string;
  mode: "login" | "signup";
  roleLabel?: string;
  setupError?: string;
};

type RuntimeConfigurationProps = {
  detail: string;
};

type SnapshotPortalProps = {
  snapshot: {
    actor?: unknown;
    options?: unknown;
    tenantName: string;
  };
};

vi.mock("next/cache", () => ({
  unstable_cache: (handler: () => unknown) => handler,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      runtime.cookieValue
        ? {
            name,
            value: runtime.cookieValue,
          }
        : undefined,
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: runtime.notFound,
  redirect: runtime.redirect,
}));

vi.mock("next/link", () => ({
  default: components.Link,
}));

vi.mock("@/server/runtime/demo-session", () => ({
  SESSION_COOKIE_NAME: "claimtech_session",
  resolveViewerFromToken: runtime.resolveViewerFromToken,
}));

vi.mock("@/server/runtime/gym-services", () => ({
  getGymPlatformServices: async () => {
    if (runtime.serviceError) {
      throw runtime.serviceError;
    }

    return {
      getMemberReservationSnapshot: runtime.getMemberReservationSnapshot,
      getPublicMembershipSignupSnapshot: runtime.getPublicMembershipSignupSnapshot,
      getPublicReservationSnapshot: runtime.getPublicReservationSnapshot,
    };
  },
}));

vi.mock("@/server/persistence/platform-state", () => ({
  hasLocalPlatformSetup: runtime.hasLocalPlatformSetup,
}));

vi.mock("@/components/GymDashboardShell", () => ({
  GymDashboardShell: components.GymDashboardShell,
}));

vi.mock("@/components/LoginPageView", () => ({
  LoginPageView: components.LoginPageView,
}));

vi.mock("@/components/PublicLandingPage", () => ({
  PublicLandingPage: components.PublicLandingPage,
}));

vi.mock("@/components/PublicMembershipSignupPortal", () => ({
  PublicMembershipSignupPortal: components.PublicMembershipSignupPortal,
}));

vi.mock("@/components/PublicReservationPortal", () => ({
  PublicReservationPortal: components.PublicReservationPortal,
}));

vi.mock("@/components/RuntimeConfigurationState", () => ({
  RuntimeConfigurationState: components.RuntimeConfigurationState,
}));

vi.mock("@/components/theme/LazyThemeModeSwitch", () => ({
  LazyThemeModeSwitch: components.LazyThemeModeSwitch,
}));

const { default: HomePage } = await import("@/app/page");
const { default: LoginPage } = await import("@/app/login/page");
const { default: JoinPage } = await import("@/app/join/page");
const { default: ReservePage } = await import("@/app/reserve/page");
const { default: DashboardIndexPage } = await import("@/app/dashboard/page");
const { default: DashboardSectionPage } = await import("@/app/dashboard/[section]/page");
const { default: PricingPage } = await import("@/app/pricing/page");

function expectComponent<TProps>(
  element: unknown,
  component: (props: TProps) => ReactElement | null,
) {
  expect((element as ReactElement<TProps>).type).toBe(component);

  return (element as ReactElement<TProps>).props;
}

function findComponentProps<TProps>(
  node: ReactNode,
  component: (props: TProps) => ReactElement | null,
): TProps {
  if (isValidElement<TProps>(node) && node.type === component) {
    return node.props;
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    for (const child of Children.toArray(node.props.children)) {
      try {
        return findComponentProps(child, component);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "Component not found") {
          throw error;
        }
      }
    }
  }

  throw new Error("Component not found");
}

function findAllComponentProps<TProps>(
  node: ReactNode,
  component: (props: TProps) => ReactElement | null,
): TProps[] {
  const matches: TProps[] = [];

  if (isValidElement<TProps>(node) && node.type === component) {
    matches.push(node.props);
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    for (const child of Children.toArray(node.props.children)) {
      matches.push(...findAllComponentProps(child, component));
    }
  }

  return matches;
}

beforeEach(() => {
  runtime.cookieValue = undefined;
  runtime.viewer = null;
  runtime.isSetupComplete = true;
  runtime.serviceError = null;
  runtime.publicReservationSnapshot = {
    tenantName: "Northside Athletics",
    classSessions: [],
  };
  runtime.publicMembershipSignupSnapshot = {
    tenantName: "Northside Athletics",
    membershipPlans: [],
  };
  runtime.memberReservationSnapshot = {
    tenantName: "Northside Athletics",
    classSessions: [],
  };
  runtime.getPublicReservationSnapshot.mockImplementation(async (options?: unknown) => ({
    ...runtime.publicReservationSnapshot,
    options,
  }));
  runtime.getPublicMembershipSignupSnapshot.mockImplementation(async (options?: unknown) => ({
    ...runtime.publicMembershipSignupSnapshot,
    options,
  }));
  runtime.getMemberReservationSnapshot.mockImplementation(
    async (actor: unknown, options?: unknown) => ({
      ...runtime.memberReservationSnapshot,
      actor,
      options,
    }),
  );
  runtime.resolveViewerFromToken.mockImplementation(async (token?: string) =>
    token ? runtime.viewer : null,
  );
  runtime.hasLocalPlatformSetup.mockImplementation(async () => runtime.isSetupComplete);
  vi.clearAllMocks();
});

describe("app page flow integrations", () => {
  it("shows the public landing page for anonymous visitors and redirects signed-in viewers", async () => {
    const anonymousHome = await HomePage();
    const anonymousProps = expectComponent<SnapshotPortalProps>(
      anonymousHome,
      components.PublicLandingPage,
    );

    expect(anonymousProps.snapshot.tenantName).toBe("Northside Athletics");
    expect(runtime.getPublicReservationSnapshot).toHaveBeenCalledOnce();

    runtime.cookieValue = "member-session";
    runtime.viewer = {
      actor: { subjectId: "member:nina" },
      roleKey: "member",
      roleLabel: "Lid",
    };
    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/reserve");

    runtime.viewer = {
      actor: { subjectId: "owner:amina" },
      roleKey: "owner",
      roleLabel: "Eigenaar",
    };
    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("keeps login setup, login, errors, and viewer role labels wired together", async () => {
    runtime.isSetupComplete = false;
    const setupLogin = await LoginPage({});
    expect(expectComponent<LoginViewProps>(setupLogin, components.LoginPageView)).toMatchObject({
      isSetupComplete: false,
      mode: "signup",
    });

    runtime.isSetupComplete = true;
    runtime.cookieValue = "owner-session";
    runtime.viewer = {
      actor: { subjectId: "owner:amina" },
      roleKey: "owner",
      roleLabel: "Eigenaar",
    };
    const login = await LoginPage({
      searchParams: Promise.resolve({
        error: ["Ongeldige login"],
        setupError: "Setup mislukt",
      }),
    });
    expect(expectComponent<LoginViewProps>(login, components.LoginPageView)).toMatchObject({
      isSetupComplete: true,
      loginError: "Ongeldige login",
      mode: "login",
      roleLabel: "Eigenaar",
      setupError: "Setup mislukt",
    });

    const forcedSignup = await LoginPage({
      searchParams: Promise.resolve({ mode: "signup" }),
    });
    expect(expectComponent<LoginViewProps>(forcedSignup, components.LoginPageView).mode).toBe(
      "signup",
    );
  });

  it("renders join and reserve portals publicly, with member snapshots only for member sessions", async () => {
    const join = await JoinPage({
      searchParams: Promise.resolve({ gym: ["atlas-forge-club"] }),
    });
    const joinProps = findComponentProps<SnapshotPortalProps>(
      join,
      components.PublicMembershipSignupPortal,
    );

    expect(joinProps.snapshot.options).toEqual({ tenantSlug: "atlas-forge-club" });
    expect(runtime.getPublicMembershipSignupSnapshot).toHaveBeenCalledWith({
      tenantSlug: "atlas-forge-club",
    });

    const anonymousReserve = await ReservePage({
      searchParams: Promise.resolve({ gym: "atlas-forge-club" }),
    });
    const anonymousReserveProps = findComponentProps<SnapshotPortalProps>(
      anonymousReserve,
      components.PublicReservationPortal,
    );

    expect(anonymousReserveProps.snapshot.options).toEqual({ tenantSlug: "atlas-forge-club" });
    expect(runtime.getPublicReservationSnapshot).toHaveBeenCalledWith({
      tenantSlug: "atlas-forge-club",
    });

    runtime.cookieValue = "owner-session";
    runtime.viewer = {
      actor: { subjectId: "owner:amina" },
      roleKey: "owner",
      roleLabel: "Eigenaar",
    };
    const ownerReserve = await ReservePage({
      searchParams: Promise.resolve({ gym: "northside-athletics" }),
    });
    const ownerReserveProps = findComponentProps<SnapshotPortalProps>(
      ownerReserve,
      components.PublicReservationPortal,
    );

    expect(ownerReserveProps.snapshot.options).toEqual({ tenantSlug: "northside-athletics" });
    expect(runtime.getPublicReservationSnapshot).toHaveBeenCalledWith({
      tenantSlug: "northside-athletics",
    });

    runtime.viewer = {
      actor: { subjectId: "member:nina" },
      roleKey: "member",
      roleLabel: "Lid",
    };
    const reserve = await ReservePage({
      searchParams: Promise.resolve({ gym: "northside-athletics" }),
    });
    const reserveProps = findComponentProps<SnapshotPortalProps>(
      reserve,
      components.PublicReservationPortal,
    );

    expect(reserveProps.snapshot.options).toEqual({ tenantSlug: "northside-athletics" });
    expect(reserveProps.snapshot.actor).toEqual({ subjectId: "member:nina" });
  });

  it("routes dashboard index and section pages to full management pages", async () => {
    const overview = await DashboardIndexPage();

    expect(expectComponent<DashboardShellProps>(overview, components.GymDashboardShell)).toEqual({
      currentPage: "overview",
    });

    const members = await DashboardSectionPage({
      params: Promise.resolve({ section: "members" }),
    });
    expect(expectComponent<DashboardShellProps>(members, components.GymDashboardShell)).toEqual({
      currentPage: "members",
    });

    const reservationAlias = await DashboardSectionPage({
      params: Promise.resolve({ section: "reservations" }),
    });
    expect(
      expectComponent<DashboardShellProps>(reservationAlias, components.GymDashboardShell),
    ).toEqual({
      currentPage: "classes",
    });

    await expect(
      DashboardSectionPage({
        params: Promise.resolve({ section: "overview" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(
      DashboardSectionPage({
        params: Promise.resolve({ section: "missing" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("keeps the pricing page wired to signup and reservation entry points", () => {
    const pricing = PricingPage();
    const linkHrefs = findAllComponentProps<LinkProps>(
      pricing,
      components.Link,
    ).map((props) => props.href);

    expect(linkHrefs).toContain("/reserve");
    expect(linkHrefs.filter((href) => href === "/login?mode=signup")).toHaveLength(4);
    expect(findComponentProps(pricing, components.LazyThemeModeSwitch)).toEqual({});
  });

  it("uses understandable runtime fallbacks when page data cannot be loaded", async () => {
    runtime.serviceError = new Error("MongoDB configuratie ontbreekt");
    const homeFallback = await HomePage();

    expect(
      expectComponent<RuntimeConfigurationProps>(
        homeFallback,
        components.RuntimeConfigurationState,
      ),
    ).toEqual({
      detail: "MongoDB configuratie ontbreekt",
    });

    const joinFallback = await JoinPage({});
    expect(
      expectComponent<RuntimeConfigurationProps>(
        joinFallback,
        components.RuntimeConfigurationState,
      ),
    ).toEqual({
      detail: "MongoDB configuratie ontbreekt",
    });

    runtime.cookieValue = "member-session";
    runtime.viewer = {
      actor: { subjectId: "member:nina" },
      roleKey: "member",
      roleLabel: "Lid",
    };
    const reserveFallback = await ReservePage({});
    expect(
      expectComponent<RuntimeConfigurationProps>(
        reserveFallback,
        components.RuntimeConfigurationState,
      ),
    ).toEqual({
      detail: "MongoDB configuratie ontbreekt",
    });

    runtime.serviceError = null;
    runtime.hasLocalPlatformSetup.mockRejectedValueOnce(new Error("Setup store onbereikbaar"));
    const loginFallback = await LoginPage({});
    expect(
      expectComponent<RuntimeConfigurationProps>(
        loginFallback,
        components.RuntimeConfigurationState,
      ),
    ).toEqual({
      detail: "Setup store onbereikbaar",
    });
  });
});
