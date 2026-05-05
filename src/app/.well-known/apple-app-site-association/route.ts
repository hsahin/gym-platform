const appId = `${process.env.APPLE_TEAM_ID?.trim() || "TEAMID"}.nl.gymos.members`;

export function GET() {
  return Response.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appIDs: [appId],
            components: [
              { "/": "/reserve*", comment: "Open member class reservations." },
              { "/": "/join*", comment: "Open member signup." },
              { "/": "/login*", comment: "Open member login." },
            ],
          },
        ],
      },
      webcredentials: {
        apps: [appId],
      },
    },
    {
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=3600",
      },
    },
  );
}
