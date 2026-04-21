import type { PublicReservationSnapshot } from "@/server/types";

function formatCountLabel(
  count: number,
  singular: string,
  plural: string,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function getReservationExperience(snapshot: PublicReservationSnapshot) {
  const totalCapacity = snapshot.classSessions.reduce(
    (sum, classSession) => sum + classSession.capacity,
    0,
  );
  const totalBooked = snapshot.classSessions.reduce(
    (sum, classSession) => sum + classSession.bookedCount,
    0,
  );
  const totalWaitlist = snapshot.classSessions.reduce(
    (sum, classSession) => sum + classSession.waitlistCount,
    0,
  );
  const openSpots = Math.max(totalCapacity - totalBooked, 0);
  const hasClasses = snapshot.classSessions.length > 0;

  return {
    hasClasses,
    heroBadges: hasClasses
      ? ["Member journey", "Live rooster", "Direct bevestigd"]
      : ["Founder edition", "Binnenkort live", "Member-ready"],
    rosterSummary: hasClasses
      ? {
          label: "Roosterpulse",
          value: formatCountLabel(
            snapshot.classSessions.length,
            "les live",
            "lessen live",
          ),
          helper: `${formatCountLabel(openSpots, "openstaande plek", "openstaande plekken")} en ${formatCountLabel(totalWaitlist, "wachtende", "wachtenden")} in de huidige flow.`,
        }
      : {
          label: "Opening in opbouw",
          value: "Opening in opbouw",
          helper:
            "Deze member-ervaring staat klaar. Publiceer je eerste les en laat reserveringen direct binnenstromen.",
        },
    insightCards: hasClasses
      ? [
          {
            label: "Open plekken",
            value: `${openSpots}`,
            helper: "Beschikbaar voor directe bevestiging in de live flow.",
          },
          {
            label: "Wachtlijst",
            value: `${totalWaitlist}`,
            helper: "Vrijgekomen plekken schuiven automatisch door.",
          },
        ]
      : [
          {
            label: "Eerste drop",
            value: "Founder members",
            helper: "Gebruik je eerste classes om schaarste en clubgevoel meteen goed neer te zetten.",
          },
          {
            label: "Na publicatie",
            value: "Direct bevestigd",
            helper: "Reserveringen, confirmations en beheer worden direct actief zodra je eerste les live staat.",
          },
        ],
    emptyState: hasClasses
      ? null
      : {
          title: "Nieuwe class drops openen hier als eerste.",
          description:
            "De booking-ervaring staat al klaar in premium vorm. Voeg alleen nog je eerste live les toe om van pre-launch naar directe conversie te gaan.",
          highlights: [
            "De eerste live les activeert direct reserveringen, wachtlijst en confirmations.",
            "Je frontdesk en owner-dashboard zien dezelfde flow terug zonder extra inrichting.",
            "Deze pagina voelt nu al als een high-end studio in plaats van een kale placeholder.",
          ],
        },
    promiseCards: [
      {
        title: "Snelle keuze",
        copy: "Les, coach, beschikbaarheid en locatie staan direct op één plek.",
      },
      {
        title: "Premium gevoel",
        copy: "De ervaring voelt als een studio-brand, niet als een utilitair portaal.",
      },
      {
        title: "Beheer loopt mee",
        copy: "Balie, operations en owner zien dezelfde reservering direct terug in het platform.",
      },
    ],
  };
}
