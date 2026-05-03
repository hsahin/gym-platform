import type {
  DashboardFeatureCategoryKey,
  DashboardFeatureDefinition,
} from "@/features/dashboard-feature-catalog";

type FeatureCopy = {
  readonly title: string;
  readonly description: string;
};

export const DASHBOARD_FEATURE_CATEGORY_LABELS: Record<
  DashboardFeatureCategoryKey,
  string
> = {
  business: "Bedrijf beheren",
  booking: "Reserveringen",
  coaching: "Coaching",
  retention: "Retentie",
  billing: "Betalingen",
  mobile: "Mobiele app",
  marketing: "Marketing",
  integrations: "Integraties",
};

export const DASHBOARD_FEATURE_UI_COPY: Record<string, FeatureCopy> = {
  "membership.management": {
    title: "Leden en lidmaatschappen",
    description: "Beheer leden, lidmaatschappen, waivers en toegang tot het ledenportaal.",
  },
  "staff.management": {
    title: "Medewerkers",
    description: "Nodig eigenaren, managers, trainers en baliemedewerkers uit per gym.",
  },
  "access.24_7": {
    title: "24/7 toegang",
    description: "Beheer toegang op afstand, beheerdersacties en beleid voor slimme sloten.",
  },
  "checkin.studio": {
    title: "Studio-aanwezigheid",
    description: "Registreer balie- en QR-aanwezigheid direct op lessen.",
  },
  "analytics.advanced": {
    title: "Geavanceerde analytics",
    description: "Volg bezetting, omzetgereedheid, ledensignalen en operationele aandachtspunten.",
  },
  "clubs.multi_location": {
    title: "Meerdere vestigingen",
    description: "Beheer meerdere gyms vanuit één clubomgeving met vestigingsspecifieke context.",
  },
  "commerce.webshop_pos": {
    title: "Webshop en kassa",
    description: "Activeer verkoop per vestiging, productbundels en eenvoudige kassa-afrekening.",
  },
  "booking.scheduling": {
    title: "Roosterplanning",
    description: "Plan herhalende lessen, capaciteit, trainers en focus vanuit één scherm.",
  },
  "booking.group_classes": {
    title: "Groepslessen boeken",
    description: "Laat leden lessen reserveren met wachtlijst en aanwezigheidregistratie.",
  },
  "booking.one_to_one": {
    title: "1-op-1 afspraken",
    description: "Bied PT-, intake- of privéafspraken aan met eigen tijdsloten.",
  },
  "booking.online_trial": {
    title: "Online proefles boeken",
    description: "Publiceer proeflesmomenten vanuit dezelfde roosterlaag.",
  },
  "booking.credit_system": {
    title: "Strippenkaarten",
    description: "Koppel rittenkaarten en lesbundels aan lidmaatschappen en losse producten.",
  },
  "coaching.workout_plans": {
    title: "Trainingsplannen",
    description: "Bouw programma's, templates en progressies voor leden.",
  },
  "coaching.nutrition": {
    title: "Voedingscoaching",
    description: "Deel voedingsbegeleiding, voortgangsmomenten en doelgerichte ondersteuning.",
  },
  "coaching.on_demand_videos": {
    title: "Videotheek op aanvraag",
    description: "Bied verdiepende videotheken en techniekcontent alleen voor leden aan.",
  },
  "coaching.progress_tracking": {
    title: "Voortgang bijhouden",
    description: "Volg mijlpalen, coachingnotities en voortgangsupdates.",
  },
  "coaching.heart_rate": {
    title: "Hartslagcoaching",
    description: "Gebruik sporthorloges en zonesignalen in trainingsbegeleiding.",
  },
  "coaching.ai_max": {
    title: "MAX AI Coach",
    description: "Gebruik AI-ondersteuning voor plansuggesties en voortgangssamenvattingen.",
  },
  "retention.planner": {
    title: "Retentieplanner",
    description: "Volg opzegsignalen en start opvolging voordat leden afhaken.",
  },
  "retention.community_groups": {
    title: "Clubgroepen",
    description: "Maak clubgroepen en vaste verantwoordingskringen aan.",
  },
  "retention.challenges_rewards": {
    title: "Uitdagingen en beloningen",
    description: "Organiseer uitdagingen, reeksen en beloningen om leden betrokken te houden.",
  },
  "retention.questionnaire": {
    title: "Vragenlijsten",
    description: "Verzamel feedback, paraatheid en intentie met configureerbare vragenlijsten.",
  },
  "retention.pro_content": {
    title: "PRO+ ledencontent",
    description: "Publiceer verdiepende educatie en gestructureerde ledentrajecten.",
  },
  "retention.fitzone": {
    title: "FitZone",
    description: "Bouw merkervaringen rond gewoontes, herstel en leefstijl.",
  },
  "billing.processing": {
    title: "Betaalverwerking",
    description: "Configureer betaalproviders en uitbetalingsdetails per gym.",
  },
  "billing.credit_cards": {
    title: "Kaartbetalingen",
    description: "Ondersteun eenmalige kaartbetalingen en online checkout via Mollie.",
  },
  "billing.direct_debit": {
    title: "Automatische incasso",
    description: "Verwerk terugkerende SEPA-incasso voor lidmaatschappen en verlengingen.",
  },
  "billing.autocollect": {
    title: "AutoCollect",
    description: "Automatiseer betaalopvolging, herinneringen en open betaalacties voor gymteams.",
  },
  "mobile.white_label": {
    title: "Merkapp",
    description: "Toon het gymmerk in een configureerbare mobiele app voor leden.",
  },
  "mobile.fitness_coaching": {
    title: "Fitnesscoaching-app",
    description: "Breng coachingacties, roosters en ledentrajecten naar mobiel.",
  },
  "mobile.nutrition_coaching": {
    title: "Voedingscoaching-app",
    description: "Maak voeding, opvolging en voortgangsmomenten beschikbaar in de app.",
  },
  "mobile.checkin": {
    title: "Mobiele aankomst",
    description: "Laat leden mobiel of via QR aankomen bij lessen en studio's.",
  },
  "marketing.email": {
    title: "E-mailmarketing",
    description: "Stuur gerichte nurture- en winbackcampagnes vanuit gymdata.",
  },
  "marketing.promotions": {
    title: "In-app promoties",
    description: "Publiceer banners, upsells en conversiemomenten in de app.",
  },
  "marketing.leads": {
    title: "Aanvraagbeheer",
    description: "Volg aanvragen, opvolging en conversie van proefles naar contract.",
  },
  "integrations.hardware": {
    title: "Ondersteunde hardware",
    description: "Beheer sloten, scanners en clubhardware vanuit één overzicht.",
  },
  "integrations.software": {
    title: "Softwarekoppelingen",
    description: "Koppel CRM, messaging, BI en externe bedrijfssoftware.",
  },
  "integrations.equipment": {
    title: "Apparaatkoppelingen",
    description: "Gebruik trainings- en aanwezigheidsdata uit verbonden apparatuur.",
  },
  "integrations.virtuagym_connect": {
    title: "Virtuagym Connect",
    description: "Verbind rooster-, leden- en migratiedata uit Virtuagym-achtige installaties.",
  },
  "integrations.body_composition": {
    title: "Lichaamssamenstelling",
    description: "Koppel metingen en scanapparatuur aan ledenvoortgang.",
  },
};

export function getDashboardFeatureUiCopy(
  feature: Pick<DashboardFeatureDefinition, "key" | "title" | "description">,
) {
  return DASHBOARD_FEATURE_UI_COPY[feature.key] ?? {
    title: feature.title,
    description: feature.description,
  };
}

export function getDashboardFeatureCategoryLabel(
  feature: { readonly categoryKey: string; readonly categoryTitle: string },
) {
  return (
    DASHBOARD_FEATURE_CATEGORY_LABELS[
      feature.categoryKey as DashboardFeatureCategoryKey
    ] ?? feature.categoryTitle
  );
}

export function getDashboardFeatureStatusLabel(
  status: DashboardFeatureDefinition["statusLabel"],
) {
  switch (status) {
    case "Expanded":
      return "Uitgebreid";
    case "New":
      return "Nieuw";
    default:
      return "Live";
  }
}

export function getDashboardFeatureFlagStateLabel(enabled: boolean) {
  return enabled ? "Ingeschakeld" : "Uitgeschakeld";
}

export function getDashboardFeatureReasonLabel(reason: string) {
  switch (reason) {
    case "tenant_override":
      return "Clubinstelling";
    case "actor_override":
      return "Gebruikersinstelling";
    case "rollout":
      return "Standaard beschikbaar";
    default:
      return "Standaard";
  }
}
