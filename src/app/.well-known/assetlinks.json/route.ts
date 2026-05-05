function getAndroidCertificateFingerprints() {
  const configured = process.env.ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS?.trim();

  if (!configured) {
    return ["REPLACE_WITH_RELEASE_SHA256_CERT_FINGERPRINT"];
  }

  return configured
    .split(",")
    .map((fingerprint) => fingerprint.trim())
    .filter(Boolean);
}

export function GET() {
  return Response.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "nl.gymos.members",
          sha256_cert_fingerprints: getAndroidCertificateFingerprints(),
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
