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
    expect(source).toContain("De werkbank helpt je vestigingen, lidmaatschappen");
    expect(source).toContain("Inloggen");
    expect(source).not.toContain("Team login");
    expect(source).not.toContain("workbench helpt");
    expect(source).not.toContain("memberships");
    expect(source).not.toContain("Run bookings, members, payments");
    expect(source).not.toContain("Multi-gym");
  });

  it("keeps the login page guidance in consistent Dutch", () => {
    const source = readComponentSource("LoginPageView.tsx");

    expect(source).toContain("Toegang voor eigenaars, medewerkers en leden.");
    expect(source).toContain('"Accounttoegang"');
    expect(source).toContain("Start");
    expect(source).not.toContain("Owner access, tenant setup, and workspace entry.");
    expect(source).not.toContain("Account login");
  });

  it("keeps the pricing page Dutch and signup-focused", () => {
    const source = readAppSource("pricing/page.tsx");

    expect(source).toContain("Kies de setup die past bij je sportschool.");
    expect(source).toContain("Prijzen bewust eenvoudig.");
    expect(source).toContain("Eigenaarsdashboard");
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
    expect(source).toContain("Eenmalige betaling (hele contractduur)");
    expect(source).toContain("Betaalverzoek");
    expect(source).toContain("Ledenportaalwachtwoord");
    expect(source).toContain("Checkout starten");
    expect(source).toContain("checkoutDisabledReason");
    expect(source).toContain("missingCheckoutFields");
    expect(source).toContain("snapshot.billingMissingFields");
    expect(source).toContain("snapshot.legalMissingFields");
    expect(source).toContain("betaalprofiel");
    expect(source).toContain("voorwaardenlink");
    expect(source).toContain("privacylink");
    expect(source).toContain("contracttemplate");
    expect(source).toContain("webhook-url");
    expect(source).toContain("snapshot.billingMessage");
    expect(source).toContain("snapshot.legalMessage");
    expect(source).toContain("De club deelt de voorwaarden en privacyinformatie");
    expect(source).toContain("window.location.assign");
    expect(source).not.toContain("Checkout staat nog niet live; deze club moet Mollie eerst activeren.");
    expect(source).not.toContain("nog niet ingevuld");
    expect(source).not.toContain("Join the gym");
    expect(source).not.toContain("Checkout methode");
    expect(source).not.toContain("De owner rondt daarna");
    expect(source).not.toContain("owner je aanvraag");
  });

  it("keeps the reservation portal member-facing and Dutch-first", () => {
    const source = readComponentSource("PublicReservationPortal.tsx");

    expect(source).toContain("Lesreserveringen");
    expect(source).toContain("Inloggen");
    expect(source).toContain("Kies je les");
    expect(source).toContain("Boeken kan alleen als lid");
    expect(source).toContain("komende maand");
    expect(source).toContain("Boek proefles");
    expect(source).toContain("Word lid");
    expect(source).toContain("Vrij trainen");
    expect(source).toContain("Geen trainer");
    expect(source).toContain('action="/api/auth/logout"');
    expect(source).toContain("Uitloggen");
    expect(source).toContain("Mijn reserveringen");
    expect(source).toContain("aangemeld");
    expect(source).toContain("Lessen en gymplekken waarvoor je al bent aangemeld.");
    expect(source).toContain("canUseSelfService");
    expect(source).toContain("snapshot.selfServiceEnabled");
    expect(source).toContain("shouldShowSelfService");
    expect(source).toContain("Ledenservice");
    expect(source).toContain("Betalingsbewijzen");
    expect(source).toContain("formatEuroFromCents");
    expect(source).not.toContain("EUR {(receipt.amountCents / 100).toFixed(2)}");
    expect(source).not.toContain("Je reserveert direct bij");
    expect(source).not.toContain("De club ziet je reservering direct");
    expect(source).not.toContain("Club reservations");
    expect(source).not.toContain("Member self-service");
    expect(source).not.toContain("Receipts");
    expect(source).not.toContain(">Home<");
    expect(source).not.toContain("Team login");
  });

  it("keeps the system fallback screen understandable in Dutch", () => {
    const source = readComponentSource("RuntimeConfigurationState.tsx");

    expect(source).toContain("Systeemconfiguratie");
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
    expect(signupSource).toContain("Checkout starten kan nog niet");
    expect(signupSource).toContain("isDisabled={isPending || !signupReady}");

    expect(reservationSource).toContain("const paymentMethodRequestReady =");
    expect(reservationSource).toContain("const pauseRequestReady =");
    expect(reservationSource).toContain("const memberReservationReady =");
    expect(reservationSource).toContain("Vul eerst alle velden in voordat je het verzoek verstuurt.");
  });

  it("keeps the public signup fields inside a semantic form", () => {
    const source = readComponentSource("PublicMembershipSignupPortal.tsx");
    const formStart = source.indexOf("<form");
    const passwordField = source.indexOf("Ledenportaalwachtwoord");
    const formEnd = source.indexOf("</form>");

    expect(formStart).toBeGreaterThanOrEqual(0);
    expect(passwordField).toBeGreaterThan(formStart);
    expect(passwordField).toBeLessThan(formEnd);
    expect(source).toContain("onSubmit={(event) => {");
    expect(source).toContain("event.preventDefault();");
    expect(source).toContain('type="submit"');
    expect(source).toContain('autoComplete="new-password"');
  });
});
