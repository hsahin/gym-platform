function getAndroidCertificateFingerprints() {
  const configured = process.env.ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS?.trim();

  if (!configured) {
    return null;
  }

  const fingerprints = configured
    .split(",")
    .map((fingerprint) => fingerprint.trim().toUpperCase())
    .filter(Boolean);

  if (
    fingerprints.length === 0 ||
    fingerprints.some(
      (fingerprint) => !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fingerprint),
    )
  ) {
    return null;
  }

  return fingerprints;
}

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

export function GET() {
  const fingerprints = getAndroidCertificateFingerprints();

  if (!fingerprints) {
    return deepLinkConfigError(["ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS"]);
  }

  return Response.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "nl.gymos.members",
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=3600",
      },
    },
  );
}
