import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readComponentSource(fileName: string) {
  return readFileSync(path.join(process.cwd(), "src/components", fileName), "utf8");
}

function readAppSource(fileName: string) {
  return readFileSync(path.join(process.cwd(), "src/app", fileName), "utf8");
}

describe("public surface copy", () => {
  it("keeps the landing page copy clear and Dutch-first", () => {
    const source = readComponentSource("PublicLandingPage.tsx");

    expect(source).toContain(
      "Beheer reserveringen, leden, betalingen en toegang vanuit één rustig overzicht.",
    );
    expect(source).toContain("Sportscholen met meerdere vestigingen");
    expect(source).toContain("Live roosterdata");
    expect(source).not.toContain("Run bookings, members, payments");
    expect(source).not.toContain("Multi-gym");
  });

  it("keeps the login page guidance in consistent Dutch", () => {
    const source = readComponentSource("LoginPageView.tsx");

    expect(source).toContain("Toegang voor eigenaars, team en leden.");
    expect(source).toContain('"Accounttoegang"');
    expect(source).toContain("Start");
    expect(source).not.toContain("Owner access, tenant setup, and workspace entry.");
    expect(source).not.toContain("Account login");
  });

  it("keeps the pricing page Dutch and signup-focused", () => {
    const source = readAppSource("pricing/page.tsx");

    expect(source).toContain("Kies de setup die past bij je sportschool.");
    expect(source).toContain("Prijzen bewust eenvoudig.");
    expect(source).toContain("Ownerdashboard");
    expect(source).not.toContain("Pricing kept deliberately simple.");
    expect(source).not.toContain("Choose the setup that matches your gym footprint.");
    expect(source).not.toContain("Owner dashboard");
  });

  it("keeps the signup portal labels clear for members", () => {
    const source = readComponentSource("PublicMembershipSignupPortal.tsx");

    expect(source).toContain("Lid worden");
    expect(source).toContain("Start");
    expect(source).toContain("Inloggen");
    expect(source).toContain("Betaalmethode");
    expect(source).toContain("Automatische incasso");
    expect(source).toContain("Member portal wachtwoord");
    expect(source).toContain("Checkout starten");
    expect(source).toContain("window.location.assign");
    expect(source).not.toContain("Join the gym");
    expect(source).not.toContain("Checkout methode");
    expect(source).not.toContain("De owner rondt daarna");
    expect(source).not.toContain("owner je aanvraag");
  });

  it("keeps the reservation portal member-facing and Dutch-first", () => {
    const source = readComponentSource("PublicReservationPortal.tsx");

    expect(source).toContain("Lesreserveringen");
    expect(source).toContain("Team login");
    expect(source).toContain("Kies je les");
    expect(source).toContain("Boeken kan alleen als lid");
    expect(source).toContain("Boek proefles");
    expect(source).toContain("Word lid");
    expect(source).toContain('action="/api/auth/logout"');
    expect(source).toContain("Uitloggen");
    expect(source).toContain("Ledenservice");
    expect(source).toContain("Betalingsbewijzen");
    expect(source).not.toContain("Je reserveert direct bij");
    expect(source).not.toContain("De club ziet je reservering direct");
    expect(source).not.toContain("Club reservations");
    expect(source).not.toContain("Member self-service");
    expect(source).not.toContain("Receipts");
    expect(source).not.toContain(">Home<");
  });

  it("keeps the runtime fallback screen understandable in Dutch", () => {
    const source = readComponentSource("RuntimeConfigurationState.tsx");

    expect(source).toContain("Runtimeconfiguratie");
    expect(source).toContain("Start");
    expect(source).toContain("Inloggen");
    expect(source).not.toContain("Home");
    expect(source).not.toContain("Login");
    expect(source).not.toContain("Runtime config");
  });

  it("guards existing public forms before users submit half-empty requests", () => {
    const signupSource = readComponentSource("PublicMembershipSignupPortal.tsx");
    const reservationSource = readComponentSource("PublicReservationPortal.tsx");

    expect(signupSource).toContain("const signupReady =");
    expect(signupSource).toContain("Vul eerst alle verplichte velden in");
    expect(signupSource).toContain("isDisabled={isPending || !signupReady}");

    expect(reservationSource).toContain("const paymentMethodRequestReady =");
    expect(reservationSource).toContain("const pauseRequestReady =");
    expect(reservationSource).toContain("const memberReservationReady =");
    expect(reservationSource).toContain("Vul eerst alle velden in voordat je het verzoek verstuurt.");
  });
});
