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
  booking: "Boekingsopties",
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
    title: "Teambeheer",
    description: "Nodig owners, managers, trainers en frontdeskmedewerkers uit per gym.",
  },
  "access.24_7": {
    title: "24/7 toegang",
    description: "Beheer remote toegang, owner-acties en beleid voor slimme sloten.",
  },
  "checkin.studio": {
    title: "Studio check-in",
    description: "Registreer frontdesk- en QR-check-ins direct op lesaanwezigheid.",
  },
  "analytics.advanced": {
    title: "Geavanceerde analytics",
    description: "Volg bezetting, omzetgereedheid, ledensignalen en operationele aandachtspunten.",
  },
  "clubs.multi_location": {
    title: "Meerdere vestigingen",
    description: "Beheer meerdere gyms vanuit één tenant met vestigingsspecifieke context.",
  },
  "commerce.webshop_pos": {
    title: "Webshop en kassa",
    description: "Activeer verkoop op locatie, productbundels en eenvoudige retail-checkout.",
  },
  "booking.scheduling": {
    title: "Roosterplanning",
    description: "Plan herhalende lessen, capaciteit, trainers en focus vanuit één flow.",
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
    title: "Creditsysteem",
    description: "Koppel lesbundels en credits aan lidmaatschappen en losse producten.",
  },
  "coaching.workout_plans": {
    title: "Workoutplannen",
    description: "Bouw programma's, templates en progressies voor leden.",
  },
  "coaching.nutrition": {
    title: "Voedingscoaching",
    description: "Deel voedingsbegeleiding, check-ins en doelgerichte ondersteuning.",
  },
  "coaching.on_demand_videos": {
    title: "On-demand video's",
    description: "Bied premium videotheken en member-only techniekcontent aan.",
  },
  "coaching.progress_tracking": {
    title: "Voortgang bijhouden",
    description: "Volg mijlpalen, coachingnotities en voortgangsupdates.",
  },
  "coaching.heart_rate": {
    title: "Hartslagcoaching",
    description: "Gebruik wearables en zone-signalen in trainingsflows.",
  },
  "coaching.ai_max": {
    title: "MAX AI Coach",
    description: "Gebruik AI-ondersteuning voor plansuggesties en voortgangssamenvattingen.",
  },
  "retention.planner": {
    title: "Retentieplanner",
    description: "Volg churn-signalen en start opvolging voordat leden afhaken.",
  },
  "retention.community_groups": {
    title: "Community en groepen",
    description: "Maak clubgroepen, community's en accountability-cirkels aan.",
  },
  "retention.challenges_rewards": {
    title: "Challenges en beloningen",
    description: "Run challenges, streaks en beloningen om leden betrokken te houden.",
  },
  "retention.questionnaire": {
    title: "Vragenlijsten",
    description: "Verzamel feedback, readiness en intentie met configureerbare vragenlijsten.",
  },
  "retention.pro_content": {
    title: "PRO+ content",
    description: "Publiceer premium educatie en gestructureerde journeys voor leden.",
  },
  "retention.fitzone": {
    title: "FitZone",
    description: "Bouw branded ervaringen rond gewoontes, herstel en lifestyle.",
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
    description: "Automatiseer opvolging, retries en collection queues voor owners.",
  },
  "mobile.white_label": {
    title: "White-label app",
    description: "Toon het gymmerk in een configureerbare mobiele app voor leden.",
  },
  "mobile.fitness_coaching": {
    title: "Fitnesscoaching-app",
    description: "Breng coachingacties, roosters en member journeys naar mobiel.",
  },
  "mobile.nutrition_coaching": {
    title: "Voedingscoaching-app",
    description: "Maak voeding, accountability en check-ins beschikbaar in de app.",
  },
  "mobile.checkin": {
    title: "Mobiele check-in",
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
    title: "Leadbeheer",
    description: "Volg leads, opvolging en conversie van proefles naar contract.",
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
    title: "Equipmentkoppelingen",
    description: "Gebruik workout- en aanwezigheidsdata uit verbonden apparatuur.",
  },
  "integrations.virtuagym_connect": {
    title: "Virtuagym Connect",
    description: "Verbind rooster-, leden- en migratiedata uit Virtuagym-achtige installaties.",
  },
  "integrations.body_composition": {
    title: "Lichaamssamenstelling",
    description: "Koppel metingen en scanapparatuur aan member progressie.",
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
      return "Tenantinstelling";
    case "actor_override":
      return "Gebruikersinstelling";
    case "rollout":
      return "Rollout";
    default:
      return "Standaard";
  }
}
