import type { PublicReservationSnapshot } from "@/server/types";

export function getPublicLandingContent(snapshot: PublicReservationSnapshot) {
  const totalCapacity = snapshot.classSessions.reduce(
    (sum, classSession) => sum + classSession.capacity,
    0,
  );
  const totalBooked = snapshot.classSessions.reduce(
    (sum, classSession) => sum + classSession.bookedCount,
    0,
  );
  const waitlist = snapshot.classSessions.reduce(
    (sum, classSession) => sum + classSession.waitlistCount,
    0,
  );
  const occupancy = totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0;
  const hasLiveClasses = snapshot.classSessions.length > 0;

  return {
    heroTitle: "Run je gym als een merk waar leden direct bij willen horen.",
    primaryCta: "Plan je launch",
    secondaryCta: "Boek een les",
    ownerSectionTitle: "Voor gym owners",
    memberSectionTitle: "Voor leden",
    ownerHighlights: [
      "Boutique uitstraling",
      "Omzet, bezetting en teamflow",
      "Snelle launch",
    ],
    memberHighlights: [
      "Direct vertrouwen",
      "Slimme schaarste",
      "Van boeking naar clubgevoel",
    ],
    proofCards: hasLiveClasses
      ? [
          {
            label: "Live bezetting",
            value: `${occupancy}%`,
            helper:
              `${totalBooked} van ${totalCapacity} plekken zijn nu geboekt over het live rooster.`,
          },
          {
            label: "Bevestigde plekken",
            value: `${totalBooked}`,
            helper:
              "Dit is het totaal aantal bevestigde reserveringen over alle live lessen.",
          },
          {
            label: "Wachtlijst",
            value: `${waitlist}`,
            helper:
              "Vrijgekomen plekken worden automatisch slim doorgezet vanuit de wachtlijst.",
          },
        ]
      : [
          {
            label: "Launchstatus",
            value: "Klaar voor live",
            helper:
              "Start met een lege tenant, maar laat nu al een merkervaring zien die klaar voelt om te verkopen.",
          },
          {
            label: "Volgende stap",
            value: "Eerste les",
            helper:
              "Voeg je eerste rooster toe en open daarna direct de publieke bookingflow voor leden.",
          },
          {
            label: "Owner flow",
            value: "In 1 ritme",
            helper:
              "Owner, operations en frontdesk landen straks in dezelfde premium ervaring zodra je eerste data staat.",
          },
        ],
    ownerStage: hasLiveClasses
      ? {
          statusLabel: "Live operatie",
          statusTone: "live" as const,
          primaryMetric: {
            label: "Reserveringen",
            value: `${totalBooked}`,
          },
          secondaryMetric: {
            label: "Live capaciteit",
            value: `${totalCapacity}`,
          },
          helper:
            "Boutique uitstraling voor buiten, operationele rust voor binnen. Dat is precies waarom owners sneller willen lanceren.",
        }
      : {
          statusLabel: "Launch canvas",
          statusTone: "launch" as const,
          primaryMetric: {
            label: "Volgende stap",
            value: "Eerste les",
          },
          secondaryMetric: {
            label: "Member flow",
            value: "Member-ready",
          },
          helper:
            "Voeg je eerste rooster toe en laat daarna meteen een reserveringservaring zien die als een echte studio aanvoelt.",
        },
    stats: {
      totalCapacity,
      totalBooked,
      waitlist,
      occupancy,
    },
    highlightedClasses: snapshot.classSessions.slice(0, 3).map((classSession) => ({
      ...classSession,
      fillLabel: `${classSession.bookedCount} / ${classSession.capacity} plekken gevuld`,
    })),
  };
}

export function getLoginExperienceContent({
  accountCount,
  isSetupComplete,
}: {
  accountCount: number;
  isSetupComplete: boolean;
}) {
  return {
    heroTitle: "Van eerste locatie tot volle lesroosters.",
    ownerHighlights: [
      "Boutique uitstraling",
      "Omzet, bezetting en teamflow",
    ],
    momentumLabel: isSetupComplete
      ? `${accountCount} live account${accountCount === 1 ? "" : "s"}`
      : "Binnen één flow live",
    reservationCta: "Open reserveringspagina",
    bookingPromise: isSetupComplete
      ? "Leden voelen direct een premium booking-ervaring en teamleden stappen in een dashboard dat vertrouwen uitstraalt."
      : "Start schoon, voeg je echte data toe en laat meteen een platform zien dat klaar voelt voor members, frontdesk en eigenaarschap.",
  };
}
