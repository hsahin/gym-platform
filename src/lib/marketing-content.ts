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
    primaryCta: "Plan je livegang",
    secondaryCta: "Bekijk lessen",
    ownerSectionTitle: "Voor gymeigenaren",
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
              "Start met een lege clubomgeving, maar laat nu al een merkervaring zien die klaar voelt om te verkopen.",
          },
          {
            label: "Volgende stap",
            value: "Eerste les",
            helper:
              "Voeg je eerste rooster toe en open daarna direct de publieke reserveringsroute voor leden.",
          },
          {
            label: "Eigenarenroute",
            value: "In 1 ritme",
            helper:
              "Eigenaar, operatie en balie landen straks in dezelfde sterke ervaring zodra je eerste data staat.",
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
            "Boutique uitstraling voor buiten, operationele rust voor binnen. Dat is precies waarom eigenaren sneller willen lanceren.",
        }
      : {
          statusLabel: "Startinrichting",
          statusTone: "launch" as const,
          primaryMetric: {
            label: "Volgende stap",
            value: "Eerste les",
          },
          secondaryMetric: {
            label: "Ledenroute",
            value: "Ledenklaar",
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
    heroTitle: "Van eerste vestiging tot volle lesroosters.",
    ownerHighlights: [
      "Boutique uitstraling",
      "Omzet, bezetting en teamflow",
    ],
    momentumLabel: isSetupComplete
      ? `${accountCount} live account${accountCount === 1 ? "" : "s"}`
      : "Binnen één route live",
    reservationCta: "Open reserveringspagina",
    bookingPromise: isSetupComplete
      ? "Leden voelen direct een sterke reserveringservaring en medewerkers stappen in een dashboard dat vertrouwen uitstraalt."
      : "Start schoon, voeg je echte data toe en laat meteen een platform zien dat klaar voelt voor leden, balie en eigenaarschap.",
  };
}
