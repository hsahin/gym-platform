import type {
  AppointmentStatus,
  AttendanceChannel,
  BillingInvoiceSource,
  BillingInvoiceStatus,
  BillingPaymentMethod,
  BillingReconciliationStatus,
  BillingRefundStatus,
  BillingWebhookEventStatus,
  BookingSource,
  BookingStatus,
  ChallengeStatus,
  ClassSession,
  ClassSessionBookingKind,
  CollectionCasePaymentMethod,
  CollectionCaseStatus,
  CommunityGroupStatus,
  EntityStatus,
  LeadAutomationTrigger,
  LeadSource,
  LeadStage,
  LeadTaskStatus,
  LeadTaskType,
  MemberSignupStatus,
  MemberStatus,
  QuestionnaireStatus,
  RemoteAccessBridgeType,
  RemoteAccessConnectionStatus,
  RemoteAccessProvider,
  ReviewRequestStatus,
} from "@/server/types";

type UiLabelValue = string | null | undefined;

export const UI_LABELS = {
  appointmentStatus: {
    scheduled: "Gepland",
    completed: "Afgerond",
    cancelled: "Geannuleerd",
  },
  attendanceChannel: {
    qr: "QR-code",
    frontdesk: "Balie",
    coach: "Coach",
  },
  billingInvoiceSource: {
    membership: "Lidmaatschap",
    signup_checkout: "Online aanmelding",
    appointment_pack: "Les- of PT-pakket",
    late_fee: "Toeslag",
    manual: "Handmatig",
  },
  billingInvoiceStatus: {
    draft: "Concept",
    open: "Open",
    paid: "Betaald",
    failed: "Mislukt",
    refunded: "Terugbetaald",
  },
  billingPaymentMethod: {
    direct_debit: "Automatische incasso",
    one_time: "Eenmalige betaling",
    payment_request: "Betaalverzoek",
    cash: "Contant",
    bank_transfer: "Overschrijving",
  },
  billingReconciliationStatus: {
    balanced: "In balans",
    attention: "Aandacht nodig",
  },
  billingRefundStatus: {
    pending: "In behandeling",
    processed: "Verwerkt",
    failed: "Mislukt",
  },
  billingWebhookStatus: {
    received: "Ontvangen",
    processed: "Verwerkt",
    failed: "Mislukt",
  },
  bookingKind: {
    class: "Les",
    open_gym: "Vrij trainen",
  },
  bookingSource: {
    frontdesk: "Balie",
    coach: "Coach",
    member_app: "Ledenapp",
  },
  bookingStatus: {
    confirmed: "Bevestigd",
    waitlisted: "Wachtlijst",
    checked_in: "Ingecheckt",
    cancelled: "Geannuleerd",
  },
  challengeStatus: {
    draft: "Concept",
    active: "Actief",
    completed: "Afgerond",
    archived: "Gearchiveerd",
  },
  classLevel: {
    beginner: "Beginner",
    mixed: "Gemengd",
    advanced: "Gevorderd",
  },
  collectionCaseStatus: {
    open: "Open",
    retrying: "In opvolging",
    resolved: "Afgerond",
    cancelled: "Geannuleerd",
  },
  communityGroupStatus: {
    active: "Actief",
    archived: "Gearchiveerd",
  },
  entityStatus: {
    active: "Actief",
    paused: "Gepauzeerd",
    archived: "Gearchiveerd",
  },
  leadStage: {
    new: "Nieuw",
    contacted: "Gecontacteerd",
    trial_scheduled: "Proefles gepland",
    won: "Gewonnen",
    lost: "Verloren",
  },
  leadSource: {
    website: "Website",
    instagram: "Instagram",
    referral: "Doorverwijzing",
    walk_in: "Binnenloper",
    meta_ads: "Meta-advertenties",
    booking: "Reservering",
    system: "Systeem",
  },
  leadAutomationTrigger: {
    manual: "Handmatig",
    schedule: "Planning",
    booking_cancellation: "Geannuleerde reservering",
  },
  leadTaskStatus: {
    open: "Open",
    done: "Afgerond",
    cancelled: "Geannuleerd",
  },
  leadTaskType: {
    nurture: "Opvolging",
    abandoned_booking: "Afgebroken boeking",
    follow_up: "Nabellen",
  },
  memberSignupStatus: {
    pending_review: "Wacht op controle",
    approved: "Goedgekeurd",
    rejected: "Afgewezen",
  },
  memberStatus: {
    active: "Actief",
    trial: "Proeflid",
    paused: "Gepauzeerd",
    archived: "Gearchiveerd",
  },
  mobileRequestStatus: {
    pending: "Open",
    approved: "Goedgekeurd",
    rejected: "Afgewezen",
  },
  pointOfSaleMode: {
    frontdesk: "Balie",
    kiosk: "Kiosk",
    hybrid: "Balie en kiosk",
  },
  questionnaireStatus: {
    draft: "Concept",
    live: "Live",
    closed: "Gesloten",
  },
  remoteAccessBridgeType: {
    cloud_api: "Cloud-API",
    bridge: "Bridge",
    hub: "Hub",
  },
  remoteAccessConnectionStatus: {
    not_configured: "Niet ingericht",
    configured: "Ingericht",
    attention: "Aandacht nodig",
  },
  remoteAccessProvider: {
    nuki: "Nuki",
    salto_ks: "Salto KS",
    tedee: "Tedee",
    yale_smart: "Yale Smart",
  },
  reviewRequestStatus: {
    pending: "Open",
    approved: "Goedgekeurd",
    rejected: "Afgewezen",
  },
  role: {
    owner: "Eigenaar",
    manager: "Manager",
    trainer: "Trainer",
    frontdesk: "Balie",
    member: "Lid",
    superadmin: "Superadmin",
    "gym.owner": "Eigenaar",
    "gym.manager": "Manager",
    "gym.trainer": "Trainer",
    "gym.frontdesk": "Balie",
    "gym.member": "Lid",
  },
  trainerStatus: {
    active: "Actief",
    away: "Afwezig",
    archived: "Gearchiveerd",
  },
  systemHealthStatus: {
    healthy: "Gezond",
    degraded: "Aandacht nodig",
    unhealthy: "Kritiek",
    missing_config: "Configuratie mist",
  },
  systemCacheMode: {
    redis: "Actief",
    memory: "Tijdelijke stand",
  },
  waiverRecordStatus: {
    signed: "Ondertekend",
    requested: "Aangevraagd",
    expired: "Verlopen",
  },
  waiverStatus: {
    complete: "Waiver akkoord",
    pending: "Waiver open",
  },
} as const;

export type UiLabelDomain = keyof typeof UI_LABELS;

export function getUiLabel(domain: UiLabelDomain, value: UiLabelValue) {
  if (!value?.trim()) {
    return "Onbekend";
  }

  const labels = UI_LABELS[domain] as Record<string, string>;

  return labels[value] ?? "Onbekend";
}

export function getAppointmentStatusLabel(value: AppointmentStatus | string) {
  return getUiLabel("appointmentStatus", value);
}

export function getAttendanceChannelLabel(value: AttendanceChannel | string) {
  return getUiLabel("attendanceChannel", value);
}

export function getBillingInvoiceSourceLabel(value: BillingInvoiceSource | string) {
  return getUiLabel("billingInvoiceSource", value);
}

export function getBillingInvoiceStatusLabel(value: BillingInvoiceStatus | string) {
  return getUiLabel("billingInvoiceStatus", value);
}

export function getBillingPaymentMethodLabel(
  value: BillingPaymentMethod | CollectionCasePaymentMethod | string,
) {
  return getUiLabel("billingPaymentMethod", value);
}

export function getBillingReconciliationStatusLabel(
  value: BillingReconciliationStatus | string,
) {
  return getUiLabel("billingReconciliationStatus", value);
}

export function getBillingRefundStatusLabel(value: BillingRefundStatus | string) {
  return getUiLabel("billingRefundStatus", value);
}

export function getBillingWebhookStatusLabel(value: BillingWebhookEventStatus | string) {
  return getUiLabel("billingWebhookStatus", value);
}

export function getBookingKindLabel(value: ClassSessionBookingKind | string) {
  return getUiLabel("bookingKind", value);
}

export function getBookingSourceLabel(value: BookingSource | string) {
  return getUiLabel("bookingSource", value);
}

export function getBookingStatusLabel(value: BookingStatus | string) {
  return getUiLabel("bookingStatus", value);
}

export function getChallengeStatusLabel(value: ChallengeStatus | string) {
  return getUiLabel("challengeStatus", value);
}

export function getClassLevelLabel(value: ClassSession["level"] | string) {
  return getUiLabel("classLevel", value);
}

export function getCollectionCaseStatusLabel(value: CollectionCaseStatus | string) {
  return getUiLabel("collectionCaseStatus", value);
}

export function getCommunityGroupStatusLabel(value: CommunityGroupStatus | string) {
  return getUiLabel("communityGroupStatus", value);
}

export function getEntityStatusLabel(value: EntityStatus | string) {
  return getUiLabel("entityStatus", value);
}

export function getLeadStageLabel(value: LeadStage | string) {
  return getUiLabel("leadStage", value);
}

export function getLeadSourceLabel(value: LeadSource | "system" | string) {
  return getUiLabel("leadSource", value);
}

export function getLeadAutomationTriggerLabel(value: LeadAutomationTrigger | string) {
  return getUiLabel("leadAutomationTrigger", value);
}

export function getLeadTaskStatusLabel(value: LeadTaskStatus | string) {
  return getUiLabel("leadTaskStatus", value);
}

export function getLeadTaskTypeLabel(value: LeadTaskType | string) {
  return getUiLabel("leadTaskType", value);
}

export function getMemberSignupStatusLabel(value: MemberSignupStatus | string) {
  return getUiLabel("memberSignupStatus", value);
}

export function getMemberStatusLabel(value: MemberStatus | string) {
  return getUiLabel("memberStatus", value);
}

export function getMobileRequestStatusLabel(value: ReviewRequestStatus | string) {
  return getUiLabel("mobileRequestStatus", value);
}

export function getPointOfSaleModeLabel(value: "frontdesk" | "kiosk" | "hybrid" | string) {
  return getUiLabel("pointOfSaleMode", value);
}

export function getQuestionnaireStatusLabel(value: QuestionnaireStatus | string) {
  return getUiLabel("questionnaireStatus", value);
}

export function getRemoteAccessBridgeTypeLabel(value: RemoteAccessBridgeType | string) {
  return getUiLabel("remoteAccessBridgeType", value);
}

export function getRemoteAccessConnectionStatusLabel(
  value: RemoteAccessConnectionStatus | string,
) {
  return getUiLabel("remoteAccessConnectionStatus", value);
}

export function getRemoteAccessProviderLabel(value: RemoteAccessProvider | string) {
  return getUiLabel("remoteAccessProvider", value);
}

export function getReviewRequestStatusLabel(value: ReviewRequestStatus | string) {
  return getUiLabel("reviewRequestStatus", value);
}

export function getRoleLabel(value: string) {
  return getUiLabel("role", value);
}

export function getTrainerStatusLabel(value: "active" | "away" | "archived" | string) {
  return getUiLabel("trainerStatus", value);
}

export function getSystemHealthStatusLabel(value: string) {
  return getUiLabel("systemHealthStatus", value);
}

export function getSystemCacheModeLabel(value: string) {
  return getUiLabel("systemCacheMode", value);
}

export function getWaiverRecordStatusLabel(value: "signed" | "requested" | "expired" | string) {
  return getUiLabel("waiverRecordStatus", value);
}

export function getWaiverStatusLabel(value: "complete" | "pending" | string) {
  return getUiLabel("waiverStatus", value);
}
