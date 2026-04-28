import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClassSessionView } from "@/components/ClassSessionView";
import { Badge, Button, PhoneNumberField } from "@/components/HeroCompat";
import { LocationView } from "@/components/LocationView";
import { LoginExperiencePanel } from "@/components/LoginExperiencePanel";
import { MemberView } from "@/components/MemberView";

const baseSession = {
  id: "class-1",
  title: "Forge HIIT",
  locationId: "loc-1",
  trainerId: "trainer-1",
  startsAt: "2026-05-01T08:00:00.000Z",
  durationMinutes: 45,
  capacity: 20,
  bookedCount: 18,
  waitlistCount: 1,
  level: "mixed",
  focus: "engine",
  status: "active",
  version: 1,
  createdAt: "2026-04-01T08:00:00.000Z",
  updatedAt: "2026-04-01T08:00:00.000Z",
};

const baseLocation = {
  id: "loc-1",
  name: "Atlas Forge Oost",
  city: "Amsterdam",
  neighborhood: "Oost",
  capacity: 120,
  managerName: "Amina Hassan",
  amenities: ["kracht", "boxing", "sauna", "recovery"],
  status: "active",
  version: 1,
  createdAt: "2026-04-01T08:00:00.000Z",
  updatedAt: "2026-04-01T08:00:00.000Z",
};

const baseMember = {
  id: "member-1",
  fullName: "Nina de Jong",
  email: "nina@example.test",
  phone: "0612345678",
  phoneCountry: "NL",
  membershipPlanId: "plan-1",
  homeLocationId: "loc-1",
  status: "active",
  waiverStatus: "complete",
  tags: ["morning", "hyrox", "boxing", "pt"],
  joinedAt: "2026-04-01T08:00:00.000Z",
  nextRenewalAt: "2026-05-01T08:00:00.000Z",
  version: 1,
  createdAt: "2026-04-01T08:00:00.000Z",
  updatedAt: "2026-04-01T08:00:00.000Z",
};

const basePlan = {
  id: "plan-1",
  name: "Unlimited Jaar",
  billingCycle: "year",
  contractDurationMonths: 12,
  priceCents: 9900,
  status: "active",
  version: 1,
  createdAt: "2026-04-01T08:00:00.000Z",
  updatedAt: "2026-04-01T08:00:00.000Z",
};

describe("component render coverage", () => {
  it("renders login owner and live variants", () => {
    const setupMarkup = renderToStaticMarkup(
      <LoginExperiencePanel accountCount={0} isSetupComplete={false} />,
    );
    const liveMarkup = renderToStaticMarkup(
      <LoginExperiencePanel accountCount={4} isSetupComplete />,
    );

    expect(setupMarkup).toContain("Owner experience");
    expect(setupMarkup).toContain("Start de launch");
    expect(liveMarkup).toContain("Launch actief");
    expect(liveMarkup).toContain("Ga naar owner login");
  });

  it("renders class session occupancy variants", () => {
    const regularMarkup = renderToStaticMarkup(
      <ClassSessionView
        classSession={{ ...baseSession, bookedCount: 10 } as never}
        locationName="Atlas Forge Oost"
        trainerName="Romy de Wit"
      />,
    );
    const packedMarkup = renderToStaticMarkup(
      <ClassSessionView
        classSession={{ ...baseSession, bookedCount: 19 } as never}
      />,
    );

    expect(regularMarkup).toContain("Forge HIIT");
    expect(regularMarkup).toContain("50% vol");
    expect(regularMarkup).toContain("Romy de Wit");
    expect(packedMarkup).toContain("95% vol");
    expect(packedMarkup).toContain("TBA");
  });

  it("renders location amenity overflow and compact variants", () => {
    const overflowMarkup = renderToStaticMarkup(
      <LocationView location={baseLocation as never} />,
    );
    const compactMarkup = renderToStaticMarkup(
      <LocationView
        location={{ ...baseLocation, amenities: ["kracht", "boxing"] } as never}
      />,
    );

    expect(overflowMarkup).toContain("Atlas Forge Oost");
    expect(overflowMarkup).toContain("+1 extra");
    expect(compactMarkup).not.toContain("extra");
  });

  it("renders member status, plan and fallback variants", () => {
    const activeMarkup = renderToStaticMarkup(
      <MemberView
        homeLocationName="Atlas Forge Oost"
        member={baseMember as never}
        plan={basePlan as never}
      />,
    );
    const pausedMarkup = renderToStaticMarkup(
      <MemberView
        member={{
          ...baseMember,
          status: "paused",
          waiverStatus: "pending",
          tags: ["evening"],
        } as never}
      />,
    );

    expect(activeMarkup).toContain("Nina de Jong");
    expect(activeMarkup).toContain("Unlimited Jaar");
    expect(activeMarkup).toContain("+1 extra");
    expect(pausedMarkup).toContain("Onbekend");
    expect(pausedMarkup).toContain("waiver pending");
  });

  it("renders shared Hero compatibility primitives across supported variants", () => {
    const markup = renderToStaticMarkup(
      <div>
        {["outline", "secondary", "ghost", "destructive", "primary"].map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
        {[
          "warning",
          "destructive",
          "success",
          "info",
          "outline",
          "secondary",
          "default",
        ].map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
        <PhoneNumberField
          country="NL"
          phone="0612345678"
          phoneLabel="Mobiel"
          onCountryChange={() => undefined}
          onPhoneChange={() => undefined}
        />
      </div>,
    );

    expect(markup).toContain("destructive");
    expect(markup).toContain("Mobiel");
    expect(markup).toContain("0612345678");
  });
});
