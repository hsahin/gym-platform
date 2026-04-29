import { DASHBOARD_FEATURE_CATALOG } from "@/features/dashboard-feature-catalog";
import type { DashboardFeatureDefinition } from "@/features/dashboard-feature-catalog";
import type { GymDashboardSnapshot } from "@/server/types";

type DashboardFeatureKey = (typeof DASHBOARD_FEATURE_CATALOG)[number]["key"];

type FeaturePresenceBuilder = (
  snapshot: GymDashboardSnapshot,
  feature: DashboardFeatureDefinition,
) => string;

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatPreviewList(values: ReadonlyArray<string>) {
  if (values.length === 0) {
    return "nog niets gekoppeld";
  }

  if (values.length <= 2) {
    return values.join(", ");
  }

  return `${values.slice(0, 2).join(", ")} +${values.length - 2}`;
}

function formatCadenceLabel(value: "weekly" | "biweekly" | "monthly") {
  switch (value) {
    case "weekly":
      return "wekelijks";
    case "biweekly":
      return "tweewekelijks";
    case "monthly":
      return "maandelijks";
  }
}

function formatCheckInMode(value: GymDashboardSnapshot["mobileExperience"]["checkInMode"]) {
  switch (value) {
    case "qr":
      return "QR only";
    case "frontdesk":
      return "frontdesk only";
    case "hybrid":
      return "hybrid";
  }
}

function formatPosMode(value: GymDashboardSnapshot["revenueWorkspace"]["pointOfSaleMode"]) {
  switch (value) {
    case "frontdesk":
      return "frontdesk";
    case "kiosk":
      return "kiosk";
    case "hybrid":
      return "hybrid";
  }
}

const FEATURE_PRESENCE_BUILDERS: Record<DashboardFeatureKey, FeaturePresenceBuilder> = {
  "membership.management": (snapshot) =>
    `${formatCount(snapshot.members.length, "lid", "leden")}, ${formatCount(snapshot.membershipPlans.length, "contract", "contracten")} en ${formatCount(snapshot.waivers.length, "waiver", "waivers")} in beheer.`,
  "staff.management": (snapshot) =>
    `${formatCount(snapshot.staff.length, "teamaccount", "teamaccounts")} verdeeld over ${formatCount(snapshot.locations.length, "vestiging", "vestigingen")}.`,
  "access.24_7": (snapshot) =>
    `${snapshot.remoteAccess.statusLabel} via ${snapshot.remoteAccess.providerLabel}${snapshot.remoteAccess.locationName ? ` bij ${snapshot.remoteAccess.locationName}` : ""}.`,
  "checkin.studio": (snapshot) =>
    `${formatCount(snapshot.attendance.length, "check-in", "check-ins")} verwerkt op ${formatCount(snapshot.classSessions.length, "les", "lessen")}.`,
  "analytics.advanced": (snapshot) =>
    snapshot.uiCapabilities.canViewPlatformChecks
      ? `${formatCount(snapshot.metrics.length, "KPI", "KPI's")} en ${formatCount(snapshot.healthReport.checks.length, "platformcheck", "platformchecks")} live op de overview.`
      : `${formatCount(snapshot.metrics.length, "KPI", "KPI's")} live op de overview.`,
  "clubs.multi_location": (snapshot) =>
    `${formatCount(snapshot.locations.length, "vestiging", "vestigingen")} actief onder dezelfde tenant.`,
  "commerce.webshop_pos": (snapshot) =>
    `${snapshot.revenueWorkspace.webshopCollectionName} draait in ${formatPosMode(snapshot.revenueWorkspace.pointOfSaleMode)} modus.`,
  "booking.scheduling": (snapshot) =>
    `${formatCount(snapshot.classSessions.length, "les", "lessen")} gepland binnen een window van ${snapshot.bookingWorkspace.schedulingWindowDays} dagen, met ${snapshot.bookingPolicy.maxDailyBookingsPerMember} boeking${snapshot.bookingPolicy.maxDailyBookingsPerMember === 1 ? "" : "en"} per lid per dag.`,
  "booking.group_classes": (snapshot) =>
    `${formatCount(snapshot.bookings.length, "reservering", "reserveringen")} verwerkt, waarvan ${snapshot.bookings.filter((booking) => booking.status === "waitlisted").length} op de wachtlijst.`,
  "booking.one_to_one": (snapshot) =>
    `${snapshot.bookingWorkspace.oneToOneSessionName} staat klaar als ${snapshot.bookingWorkspace.oneToOneDurationMinutes}-minuten flow.`,
  "booking.online_trial": (snapshot) =>
    snapshot.bookingWorkspace.trialBookingUrl
      ? `Trialflow gekoppeld via ${snapshot.bookingWorkspace.trialBookingUrl}.`
      : "Trialflow aanwezig, maar de publieke trial-URL moet nog worden ingevuld.",
  "booking.credit_system": (snapshot) =>
    `${snapshot.bookingWorkspace.defaultCreditPackSize} credits per standaard pack voor class packs en intro flows.`,
  "coaching.workout_plans": (snapshot) =>
    `Workout focus staat op ${snapshot.coachingWorkspace.workoutPlanFocus}.`,
  "coaching.nutrition": (snapshot) =>
    `Voedingscoaching loopt ${formatCadenceLabel(snapshot.coachingWorkspace.nutritionCadence)} vanuit dezelfde coachworkspace.`,
  "coaching.on_demand_videos": (snapshot) =>
    snapshot.coachingWorkspace.videoLibraryUrl
      ? `Videobibliotheek gekoppeld op ${snapshot.coachingWorkspace.videoLibraryUrl}.`
      : "On-demand video’s zijn voorbereid; koppel nog een bibliotheek-URL om live te gaan.",
  "coaching.progress_tracking": (snapshot) =>
    `Progressie wordt gemeten op ${snapshot.coachingWorkspace.progressMetric}.`,
  "coaching.heart_rate": (snapshot) =>
    `Hartslagcoaching gebruikt ${snapshot.coachingWorkspace.heartRateProvider} als provider.`,
  "coaching.ai_max": (snapshot) =>
    `MAX AI Coach staat klaar in modus "${snapshot.coachingWorkspace.aiCoachMode}".`,
  "retention.planner": (snapshot) =>
    `Retentieplanner draait ${formatCadenceLabel(snapshot.retentionWorkspace.retentionCadence)} met live clubsignalen.`,
  "retention.community_groups": (snapshot) =>
    `Community en groups lopen via ${snapshot.retentionWorkspace.communityChannel}.`,
  "retention.challenges_rewards": (snapshot) =>
    `Challenge-thema staat op ${snapshot.retentionWorkspace.challengeTheme}.`,
  "retention.questionnaire": (snapshot) =>
    `Questionnaires worden getriggerd op ${snapshot.retentionWorkspace.questionnaireTrigger}.`,
  "retention.pro_content": (snapshot) =>
    snapshot.retentionWorkspace.proContentPath
      ? `PRO+ contentpad ingesteld op ${snapshot.retentionWorkspace.proContentPath}.`
      : "PRO+ content is aanwezig; voeg nog een contentpad toe om het kanaal te vullen.",
  "retention.fitzone": (snapshot) =>
    `FitZone-aanbod geconfigureerd als ${snapshot.retentionWorkspace.fitZoneOffer}.`,
  "billing.processing": (snapshot) =>
    `${snapshot.payments.providerLabel} staat op ${snapshot.payments.statusLabel.toLowerCase()} voor deze gym.`,
  "billing.credit_cards": (snapshot) =>
    snapshot.payments.paymentMethods.includes("one_time")
      ? "Eenmalige kaartbetalingen zijn actief binnen de huidige betaalstack."
      : "Kaartbetalingen zijn als feature aanwezig, maar nog niet geactiveerd in de betaalmethoden.",
  "billing.direct_debit": (snapshot) =>
    `${snapshot.payments.paymentMethods.includes("direct_debit") ? "SEPA incasso actief" : "SEPA incasso nog niet actief"} met ${snapshot.revenueWorkspace.directDebitLeadDays} dagen voorbereiding.`,
  "billing.autocollect": (snapshot) =>
    `AutoCollect volgt "${snapshot.revenueWorkspace.autocollectPolicy}" met ${formatCount(snapshot.collectionCases.length, "collection case", "collection cases")} in de opvolgqueue.`,
  "mobile.white_label": (snapshot) =>
    `${snapshot.mobileExperience.appDisplayName}${snapshot.mobileExperience.whiteLabelDomain ? ` op ${snapshot.mobileExperience.whiteLabelDomain}` : ""}.`,
  "mobile.fitness_coaching": (snapshot) =>
    `${formatCount(snapshot.memberPortalAccessMemberIds.length, "lid", "leden")} klaar voor coaching journeys in de app.`,
  "mobile.nutrition_coaching": (snapshot) =>
    `Nutrition app-flow gebruikt onboarding "${snapshot.mobileExperience.onboardingHeadline}".`,
  "mobile.checkin": (snapshot) =>
    `${formatCheckInMode(snapshot.mobileExperience.checkInMode)} check-in met ${formatCount(snapshot.supportedLanguages.length, "taal", "talen")} beschikbaar.`,
  "marketing.email": (snapshot) =>
    `E-mailmarketing verzendt als ${snapshot.marketingWorkspace.emailSenderName} via ${snapshot.marketingWorkspace.emailReplyTo}.`,
  "marketing.promotions": (snapshot) =>
    `Promoties gebruiken de headline "${snapshot.marketingWorkspace.promotionHeadline}".`,
  "marketing.leads": (snapshot) =>
    `${formatCount(snapshot.leads.length, "lead", "leads")} in pipeline ${snapshot.marketingWorkspace.leadPipelineLabel}.`,
  "integrations.hardware": (snapshot) =>
    `Hardware vendors: ${formatPreviewList(snapshot.integrationWorkspace.hardwareVendors)}.`,
  "integrations.software": (snapshot) =>
    `Softwarekoppelingen: ${formatPreviewList(snapshot.integrationWorkspace.softwareIntegrations)}.`,
  "integrations.equipment": (snapshot) =>
    `Equipmentintegraties: ${formatPreviewList(snapshot.integrationWorkspace.equipmentIntegrations)}.`,
  "integrations.virtuagym_connect": (snapshot) =>
    `Migratiebron voor Virtuagym Connect staat op ${snapshot.integrationWorkspace.migrationProvider}.`,
  "integrations.body_composition": (snapshot) =>
    snapshot.integrationWorkspace.bodyCompositionProvider
      ? `Body composition provider gekoppeld: ${snapshot.integrationWorkspace.bodyCompositionProvider}.`
      : "Body composition feature aanwezig; koppel nog een scanprovider om live data te ontvangen.",
};

export function getFeaturePresenceCoverageKeys() {
  return Object.keys(FEATURE_PRESENCE_BUILDERS).sort();
}

export function buildFeaturePresenceSummary(
  feature: Pick<DashboardFeatureDefinition, "key">,
  snapshot: GymDashboardSnapshot,
) {
  const builder = FEATURE_PRESENCE_BUILDERS[feature.key as DashboardFeatureKey];

  if (!builder) {
    return "Feature is zichtbaar in het dashboard, maar mist nog een operationele samenvatting.";
  }

  return builder(snapshot, feature as DashboardFeatureDefinition);
}
