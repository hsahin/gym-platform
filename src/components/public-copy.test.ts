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
    expect(source).toContain("Volledige contractbetaling");
    expect(source).toContain("Ledenportaalwachtwoord");
    expect(source).toContain("SEPA machtiging afgeven");
    expect(source).toContain("Betaling starten");
    expect(source).toContain("checkoutDisabledReason");
    expect(source).toContain("memberMissingFields");
    expect(source).toContain("Online inschrijven is nog niet beschikbaar bij deze club.");
    expect(source).not.toContain("missingCheckoutFields");
    expect(source).not.toContain("snapshot.billingMissingFields");
    expect(source).not.toContain("snapshot.legalMissingFields");
    expect(source).not.toContain("betaalprofiel");
    expect(source).not.toContain("voorwaardenlink");
    expect(source).not.toContain("privacylink");
    expect(source).not.toContain("contracttemplate");
    expect(source).not.toContain("webhook-url");
    expect(source).not.toContain("snapshot.billingMessage");
    expect(source).not.toContain("Los betaalverzoek");
    expect(source).not.toContain("snapshot.legalMessage");
    expect(source).not.toContain("snapshot.billingReady");
    expect(source).not.toContain("snapshot.legalReady");
    expect(source).not.toContain("snapshot.testMode");
    expect(source).not.toContain("De club deelt de voorwaarden en privacyinformatie");
    expect(source).not.toContain("ontbreekt");
    expect(source).not.toContain("ontbreken");
    expect(source).toContain("openSignupCheckout");
    expect(source).toContain("window.Capacitor?.Plugins?.Browser");
    expect(source).toContain('presentationStyle: "fullscreen"');
    // Web checkout opens in the same tab so we don't double-launch (new tab + current tab both navigating).
    expect(source).toContain("window.location.assign(checkoutUrl)");
    expect(source).not.toContain('window.open(checkoutUrl, "_blank"');
    expect(source).not.toContain("Checkout staat nog niet live; deze club moet Mollie eerst activeren.");
    expect(source).not.toContain("window.location.assign(payload.data.checkoutUrl)");
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
    expect(source).toContain("Vandaag in je club");
    expect(source).toContain("Snel regelen");
    expect(source).toContain("Annuleer plek");
    expect(source).toContain("Rooster bekijken");
    expect(source).toContain("Betalingen en contracten");
    expect(source).toContain("aangemeld");
    expect(source).toContain("Lessen en gymplekken waarvoor je al bent aangemeld.");
    expect(source).toContain("cancelMemberReservation");
    expect(source).toContain("canUseSelfService");
    expect(source).toContain("snapshot.selfServiceEnabled");
    expect(source).toContain("shouldShowSelfService");
    expect(source).toContain("Ledenservice");
    expect(source).toContain("Account verwijderen");
    expect(source).toContain("request_account_deletion");
    expect(source).toContain('id="account-verwijderen"');
    expect(source).toContain("Je login wordt direct uitgezet");
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
    expect(signupSource).toContain("Vul je gegevens in en accepteer de voorwaarden voordat je doorgaat.");
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

  it("uses polished HeroUI Pro form controls for public signup checkout readiness", () => {
    const source = readComponentSource("PublicMembershipSignupPortal.tsx");

    expect(source).toContain('import { CheckboxButtonGroup } from "@heroui-pro/react/checkbox-button-group";');
    expect(source).toContain('import { RadioButtonGroup } from "@heroui-pro/react/radio-button-group";');
    expect(source).toContain("signupAgreements");
    expect(source).toContain("setSignupAgreements");
    expect(source).toContain('name="signupAgreements"');
    expect(source).toContain('<CheckboxButtonGroup');
    expect(source).toContain('<CheckboxButtonGroup.Item key="contract" value="contract">');
    expect(source).toContain('<CheckboxButtonGroup.Item key="waiver" value="waiver">');
    expect(source).toContain("const contractAccepted = signupAgreements.includes");
    expect(source).toContain("const waiverAccepted = signupAgreements.includes");
    expect(source).toContain('<RadioButtonGroup');
    expect(source).toContain('name="membershipPlanId"');
    expect(source).toContain('name="paymentMethod"');
    expect(source).toContain("Maandelijks automatisch via veilige incasso.");
    expect(source).toContain("Betaal de volledige contractperiode in één keer.");
    expect(source).toContain("SEPA machtiging");
    expect(source).toContain('name="iban"');
    expect(source).toContain("sepaMandateAccepted");
    expect(source).toContain("fullPaymentDiscountPercent");
    expect(source).not.toContain("Alleen voor losse afspraken met de club.");
    expect(source).not.toContain("Los betaalverzoek");
    expect(source).toContain("fullWidth");
    expect(source).not.toContain('import { Card, Checkbox, Input, Label } from "@heroui/react";');
  });

  it("shows a clear public payment return state instead of dropping users on an empty form", () => {
    const pageSource = readAppSource("join/page.tsx");
    const componentSource = readComponentSource("PublicMembershipSignupPortal.tsx");

    expect(pageSource).toContain("paymentReturn");
    expect(pageSource).toContain('payment === "return"');
    expect(componentSource).toContain("paymentReturn");
    expect(componentSource).toContain("Je betaling wordt verwerkt");
    expect(componentSource).toContain("Je aanmelding is ontvangen");
  });
});
