import Link from "next/link";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import {
  SESSION_COOKIE_NAME,
  resolveViewerFromToken,
} from "@/server/runtime/demo-session";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(value));
}

function formatLongDateTime(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(value));
}

export default async function WaiverDocumentPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const viewer = await resolveViewerFromToken(token);

  if (!viewer) {
    redirect("/login");
  }

  if (viewer.roleKey === "member") {
    redirect("/reserve");
  }

  const services = await getGymPlatformServices();
  const snapshot = await services.getDashboardSnapshot(
    viewer.actor,
    viewer.tenantContext,
    { page: "members" },
  );

  const member = snapshot.members.find((entry) => entry.id === memberId);

  if (!member) {
    notFound();
  }

  const waiver = snapshot.waivers.find((entry) => entry.memberId === memberId);
  const membershipPlan = snapshot.membershipPlans.find(
    (plan) => plan.id === member.membershipPlanId,
  );
  const location = snapshot.locations.find(
    (entry) => entry.id === member.homeLocationId,
  );

  const waiverAcceptedAt =
    waiver?.uploadedAt ?? member.updatedAt ?? member.createdAt;
  const expiresAt =
    waiver?.expiresAt ?? (snapshot.legal.waiverRetentionMonths > 0
      ? new Date(
          new Date(waiverAcceptedAt).getTime() +
            snapshot.legal.waiverRetentionMonths * 30 * 24 * 60 * 60 * 1000,
        ).toISOString()
      : "");

  return (
    <main className="waiver-document">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            :root {
              color-scheme: light;
            }
            html, body {
              background: #fff;
              color: #111827;
              font-family: ui-sans-serif, system-ui, sans-serif;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .waiver-document {
              max-width: 720px;
              margin: 0 auto;
              padding: 3rem 3rem 4rem;
              line-height: 1.5;
              font-size: 0.95rem;
            }
            .waiver-print-actions {
              position: sticky;
              top: 1rem;
              display: flex;
              gap: 0.5rem;
              justify-content: flex-end;
              margin-bottom: 1.5rem;
            }
            .waiver-print-actions button,
            .waiver-print-actions a {
              border: 1px solid #d1d5db;
              background: #f9fafb;
              color: #111827;
              padding: 0.5rem 1rem;
              border-radius: 999px;
              font-size: 0.85rem;
              font-weight: 600;
              cursor: pointer;
              text-decoration: none;
            }
            .waiver-print-actions button.primary {
              background: #111827;
              color: #fff;
              border-color: #111827;
            }
            .waiver-header {
              border-bottom: 2px solid #111827;
              padding-bottom: 1.25rem;
              margin-bottom: 2rem;
              display: grid;
              gap: 0.5rem;
            }
            .waiver-eyebrow {
              font-size: 0.7rem;
              letter-spacing: 0.2em;
              text-transform: uppercase;
              color: #6b7280;
              font-weight: 700;
            }
            .waiver-title {
              font-size: 1.75rem;
              font-weight: 700;
              margin: 0;
              line-height: 1.15;
            }
            .waiver-subtitle {
              color: #4b5563;
              font-size: 0.9rem;
              margin: 0;
            }
            .waiver-section {
              margin: 1.5rem 0;
            }
            .waiver-section h2 {
              font-size: 0.7rem;
              letter-spacing: 0.18em;
              text-transform: uppercase;
              color: #6b7280;
              margin: 0 0 0.75rem;
              font-weight: 700;
            }
            .waiver-grid {
              display: grid;
              grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
              gap: 0.5rem 2rem;
              font-size: 0.9rem;
            }
            .waiver-grid dt {
              color: #6b7280;
              font-size: 0.75rem;
              text-transform: uppercase;
              letter-spacing: 0.08em;
            }
            .waiver-grid dd {
              margin: 0 0 0.5rem;
              font-weight: 500;
            }
            .waiver-statement {
              border-left: 4px solid #111827;
              padding: 0.75rem 1.25rem;
              background: #f9fafb;
              border-radius: 0 6px 6px 0;
              font-size: 0.9rem;
            }
            .waiver-signature-block {
              margin-top: 3rem;
              display: grid;
              grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
              gap: 2rem;
            }
            .waiver-signature {
              border-top: 1px solid #111827;
              padding-top: 0.5rem;
              font-size: 0.8rem;
              color: #4b5563;
            }
            .waiver-signature strong {
              display: block;
              color: #111827;
              font-size: 0.95rem;
              margin-bottom: 0.25rem;
            }
            .waiver-digital-mark {
              margin-top: 2rem;
              padding: 0.75rem 1rem;
              border: 1px dashed #9ca3af;
              border-radius: 8px;
              font-size: 0.75rem;
              color: #4b5563;
            }
            .waiver-footer {
              margin-top: 3rem;
              padding-top: 1rem;
              border-top: 1px solid #e5e7eb;
              font-size: 0.7rem;
              color: #6b7280;
              text-align: center;
            }
            @media print {
              .waiver-print-actions {
                display: none;
              }
              .waiver-document {
                padding: 1.5cm;
              }
            }
          `,
        }}
      />
      <div className="waiver-print-actions">
        <Link href="/dashboard/members">Terug</Link>
        <button
          className="primary"
          data-action="print-waiver"
          type="button"
        >
          Print / opslaan als PDF
        </button>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener("click", function (event) {
              var target = event.target;
              if (target && target.matches && target.matches('[data-action="print-waiver"]')) {
                window.print();
              }
            });
          `,
        }}
      />

      <header className="waiver-header">
        <span className="waiver-eyebrow">Waiver &amp; intake</span>
        <h1 className="waiver-title">{snapshot.tenantName}</h1>
        <p className="waiver-subtitle">
          Aansprakelijkheidsverklaring &amp; intakebevestiging — digitaal getekend
        </p>
      </header>

      <section className="waiver-section">
        <h2>Lid</h2>
        <dl className="waiver-grid">
          <div>
            <dt>Naam</dt>
            <dd>{member.fullName}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{member.email}</dd>
          </div>
          <div>
            <dt>Telefoon</dt>
            <dd>{member.phone}</dd>
          </div>
          <div>
            <dt>Lid sinds</dt>
            <dd>{formatLongDate(member.joinedAt)}</dd>
          </div>
          <div>
            <dt>Lidmaatschap</dt>
            <dd>{membershipPlan?.name ?? "Onbekend"}</dd>
          </div>
          <div>
            <dt>Vestiging</dt>
            <dd>{location?.name ?? "Onbekend"}</dd>
          </div>
        </dl>
      </section>

      <section className="waiver-section">
        <h2>Verklaring</h2>
        <p className="waiver-statement">
          Door deze waiver te accepteren verklaart {member.fullName} bekend te
          zijn met de risico&apos;s van trainen bij {snapshot.tenantName}, te
          beschikken over voldoende fysieke gezondheid om deel te nemen aan
          de trainingen, en {snapshot.tenantName} en haar medewerkers niet
          aansprakelijk te stellen voor letsel, schade of verlies tijdens of
          ten gevolge van deelname, behalve in geval van bewezen opzet of
          grove nalatigheid van de zijde van de club.
        </p>
      </section>

      <section className="waiver-section">
        <h2>Intakebevestiging</h2>
        <p>
          Het lid bevestigt dat alle verstrekte gegevens juist zijn, dat
          eventuele blessures of medische bijzonderheden gedeeld zijn met de
          club, en gaat akkoord met de huisregels en het contract van
          {" "}
          {snapshot.tenantName}.
        </p>
        {snapshot.legal.sepaMandateText ? (
          <p>
            <strong>SEPA-machtiging:</strong> {snapshot.legal.sepaMandateText}
          </p>
        ) : null}
      </section>

      <div className="waiver-signature-block">
        <div className="waiver-signature">
          <strong>{member.fullName}</strong>
          Digitaal getekend op {formatLongDateTime(waiverAcceptedAt)}
        </div>
        <div className="waiver-signature">
          <strong>{snapshot.tenantName}</strong>
          Namens de club — {snapshot.actorName}
        </div>
      </div>

      <div className="waiver-digital-mark">
        <strong>Digitaal ondertekend.</strong> Deze waiver is geaccepteerd via
        het ledenportaal van {snapshot.tenantName}. Tijdstempel:{" "}
        {formatLongDateTime(waiverAcceptedAt)}.
        {expiresAt ? (
          <>
            {" "}
            Geldig tot {formatLongDate(expiresAt)}.
          </>
        ) : null}
        {snapshot.legal.termsUrl ? (
          <>
            {" "}
            Algemene voorwaarden: {snapshot.legal.termsUrl}.
          </>
        ) : null}
        {snapshot.legal.privacyUrl ? (
          <>
            {" "}
            Privacy: {snapshot.legal.privacyUrl}.
          </>
        ) : null}
      </div>

      <p className="waiver-footer">
        Document gegenereerd op {formatLongDateTime(new Date().toISOString())} ·
        GymOS waiver document
      </p>
    </main>
  );
}
