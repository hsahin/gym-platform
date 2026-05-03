import { describe, expect, it } from "vitest";
import {
  DASHBOARD_FEATURE_CATALOG,
  getDashboardFeaturesForPage,
} from "@/features/dashboard-feature-catalog";

describe("dashboard feature catalog", () => {
  it("covers the full multi-gym feature matrix from the product brief", () => {
    expect(DASHBOARD_FEATURE_CATALOG).toHaveLength(40);
    expect(
      DASHBOARD_FEATURE_CATALOG.map((feature) => [feature.categoryTitle, feature.title]),
    ).toEqual([
      ["Bedrijf beheren", "Leden en lidmaatschappen"],
      ["Bedrijf beheren", "Medewerkers"],
      ["Bedrijf beheren", "24/7 toegang"],
      ["Bedrijf beheren", "Studio-aanwezigheid"],
      ["Bedrijf beheren", "Geavanceerde analytics"],
      ["Bedrijf beheren", "Meerdere vestigingen"],
      ["Bedrijf beheren", "Webshop en kassa"],
      ["Reserveringen", "Roosterplanning"],
      ["Reserveringen", "Groepslessen boeken"],
      ["Reserveringen", "1-op-1 afspraken"],
      ["Reserveringen", "Online proefles boeken"],
      ["Reserveringen", "Strippenkaarten"],
      ["Coaching", "Trainingsplannen"],
      ["Coaching", "Voedingscoaching"],
      ["Coaching", "Videotheek op aanvraag"],
      ["Coaching", "Voortgang bijhouden"],
      ["Coaching", "Hartslagcoaching"],
      ["Coaching", "MAX AI Coach"],
      ["Retentie", "Retentieplanner"],
      ["Retentie", "Clubgroepen"],
      ["Retentie", "Uitdagingen en beloningen"],
      ["Retentie", "Vragenlijsten"],
      ["Retentie", "PRO+ ledencontent"],
      ["Retentie", "FitZone"],
      ["Betalingen", "Betaalverwerking"],
      ["Betalingen", "Kaartbetalingen"],
      ["Betalingen", "Incasso"],
      ["Betalingen", "AutoCollect"],
      ["Mobiele app", "Merkapp"],
      ["Mobiele app", "Fitnesscoaching-app"],
      ["Mobiele app", "Voedingscoaching-app"],
      ["Mobiele app", "Mobiele aankomst"],
      ["Marketing", "E-mailmarketing"],
      ["Marketing", "In-app promoties"],
      ["Marketing", "Aanvraagbeheer"],
      ["Integraties", "Ondersteunde hardware"],
      ["Integraties", "Softwarekoppelingen"],
      ["Integraties", "Apparaatkoppelingen"],
      ["Integraties", "Virtuagym Connect"],
      ["Integraties", "Lichaamssamenstelling"],
    ]);
  });

  it("marks only the intended launch features as NEW", () => {
    expect(
      DASHBOARD_FEATURE_CATALOG.filter((feature) => feature.badgeLabel === "NEW").map(
        (feature) => feature.title,
      ),
    ).toEqual(["MAX AI Coach", "AutoCollect", "Virtuagym Connect"]);
  });

  it("maps features to their logical dashboard pages", () => {
    expect(getDashboardFeaturesForPage("coaching").map((feature) => feature.title)).toEqual([
      "Trainingsplannen",
      "Voedingscoaching",
      "Videotheek op aanvraag",
      "Voortgang bijhouden",
      "Hartslagcoaching",
      "MAX AI Coach",
    ]);
    expect(getDashboardFeaturesForPage("retention")).toHaveLength(6);
    expect(getDashboardFeaturesForPage("payments")).toHaveLength(5);
    expect(getDashboardFeaturesForPage("integrations")).toHaveLength(5);
  });
});
