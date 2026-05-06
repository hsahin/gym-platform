const memberAppBundleId = "nl.gymos.members";

function deepLinkConfigError(missing: readonly string[]) {
  return Response.json(
    {
      ok: false,
      error: "Native app-link configuratie ontbreekt.",
      missing,
    },
    {
      status: 503,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    },
  );
}

function getAppleAppId() {
  const teamId = process.env.APPLE_TEAM_ID?.trim().toUpperCase();

  if (!teamId || !/^[A-Z0-9]{10}$/.test(teamId)) {
    return null;
  }

  return `${teamId}.${memberAppBundleId}`;
}

export function GET() {
  const appId = getAppleAppId();

  if (!appId) {
    return deepLinkConfigError(["APPLE_TEAM_ID"]);
  }

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
