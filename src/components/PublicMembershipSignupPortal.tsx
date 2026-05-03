"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Card, Checkbox, Input, Label } from "@heroui/react";
import { Button } from "@/components/dashboard/HydrationSafeButton";
import { NativeSelect } from "@/components/dashboard/HydrationSafeNativeSelect";
import { toast } from "sonner";
import { MUTATION_CSRF_TOKEN } from "@/server/http/platform-api";
import type { PublicMembershipSignupSnapshot } from "@/server/types";

function formatMissingFields(fields: ReadonlyArray<string>) {
  if (fields.length === 0) {
    return "";
  }

  if (fields.length === 1) {
    return fields[0]!;
  }

  return `${fields.slice(0, -1).join(", ")} en ${fields.at(-1)}`;
}

export function PublicMembershipSignupPortal({
  snapshot,
}: {
  readonly snapshot: PublicMembershipSignupSnapshot;
}) {
  const phoneCountryOptions = ["NL", "BE", "DE", "GB", "US", "AE"] as const;
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<(typeof phoneCountryOptions)[number]>("NL");
  const [membershipPlanId, setMembershipPlanId] = useState(
    snapshot.membershipPlans[0]?.id ?? "",
  );
  const [preferredLocationId, setPreferredLocationId] = useState(
    snapshot.locations[0]?.id ?? "",
  );
  const [paymentMethod, setPaymentMethod] = useState<"direct_debit" | "one_time" | "payment_request">("direct_debit");
  const [contractAccepted, setContractAccepted] = useState(false);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [portalPassword, setPortalPassword] = useState("");
  const [notes, setNotes] = useState("");
  const termsUrl = snapshot.legal.termsUrl?.trim() ?? "";
  const privacyUrl = snapshot.legal.privacyUrl?.trim() ?? "";
  const missingCheckoutFields = [
    snapshot.tenantSlug ? null : "club",
    snapshot.billingReady
      ? null
      : snapshot.billingMissingFields.length > 0
        ? formatMissingFields(snapshot.billingMissingFields)
        : "betaalprofiel, betaalroute en webhook-url",
    snapshot.legalReady || snapshot.testMode
      ? null
      : snapshot.legalMissingFields.length > 0
        ? formatMissingFields(snapshot.legalMissingFields)
        : "voorwaardenlink, privacylink en contracttemplate",
    fullName.trim() ? null : "naam",
    email.trim() ? null : "e-mail",
    phone.trim() ? null : "telefoon",
    membershipPlanId ? null : "contract",
    preferredLocationId ? null : "vestiging",
    portalPassword.trim().length >= 8 ? null : "portal wachtwoord",
    contractAccepted ? null : "contractakkoord",
    waiverAccepted ? null : "waiverakkoord",
  ].filter((field): field is string => Boolean(field));
  const signupReady = Boolean(
    missingCheckoutFields.length === 0,
  );
  const checkoutDisabledReason = isPending
    ? "Even wachten: je aanmelding wordt verwerkt."
    : !signupReady
      ? `Checkout starten kan nog niet: vul ${formatMissingFields(missingCheckoutFields)} in.`
      : null;

  function submitSignup() {
    if (isPending || !signupReady) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/public/member-signups", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-claimtech-csrf": MUTATION_CSRF_TOKEN,
            "x-idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            tenantSlug: snapshot.tenantSlug ?? undefined,
            fullName,
            email,
            phone,
            phoneCountry,
            membershipPlanId,
            preferredLocationId,
            paymentMethod,
            contractAccepted,
            waiverAccepted,
            portalPassword,
            notes: notes || undefined,
          }),
        });
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error?.message ?? "Aanmelding mislukt.");
        }

        setFullName("");
        setEmail("");
        setPhone("");
        setPortalPassword("");
        setNotes("");
        setContractAccepted(false);
        setWaiverAccepted(false);
        if (payload.data?.checkoutUrl) {
          toast.success("Checkout gestart. Je wordt doorgestuurd naar de betaling.");
          window.location.assign(payload.data.checkoutUrl);
          return;
        }

        toast.success("Inschrijving afgerond. Je lidmaatschap staat klaar.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Aanmelding mislukt.");
      }
    });
  }

  useEffect(() => {
    setMembershipPlanId(snapshot.membershipPlans[0]?.id ?? "");
    setPreferredLocationId(snapshot.locations[0]?.id ?? "");
  }, [snapshot.locations, snapshot.membershipPlans]);

  return (
    <div className="section-stack py-6 md:py-8">
      <header className="app-header">
        <div className="app-header__brand-copy">
          <p className="text-sm font-semibold">Lid worden</p>
          <p className="text-muted text-sm">
            {snapshot.tenantSlug ? snapshot.tenantName : "Kies eerst je club"}
          </p>
        </div>
        <nav className="app-header__nav text-sm">
          <Link href="/" prefetch={false} className="text-muted transition hover:text-foreground">
            Start
          </Link>
          <Link href="/login" prefetch={false} className="text-muted transition hover:text-foreground">
            Inloggen
          </Link>
        </nav>
      </header>

      {!snapshot.tenantSlug ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.availableGyms.map((gym) => (
            <Link key={gym.id} href={`/join?gym=${gym.slug}`}>
              <Card className="rounded-[28px] border-border/80">
                <Card.Header>
                  <Card.Title>{gym.name}</Card.Title>
                  <Card.Description>Open de aanmeldflow van deze club.</Card.Description>
                </Card.Header>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="rounded-[32px] border-border/80">
          <Card.Header className="space-y-3">
            <Card.Title className="text-3xl">Word lid bij {snapshot.tenantName}</Card.Title>
            <Card.Description className="max-w-2xl text-base">
              Kies je lidmaatschap, bevestig je waiver en start direct de checkout. Na betaling staan je
              lidmaatschap, contract en ledenportaal klaar.
            </Card.Description>
          </Card.Header>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitSignup();
            }}
          >
            <Card.Content className="grid gap-4 md:grid-cols-2">
              <div className="field-stack">
                <Label>Naam</Label>
                <Input
                  autoComplete="name"
                  fullWidth
                  name="fullName"
                  placeholder="Voor- en achternaam"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </div>
              <div className="field-stack">
                <Label>E-mail</Label>
                <Input
                  autoComplete="email"
                  fullWidth
                  name="email"
                  placeholder="naam@voorbeeld.nl"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="field-stack">
                <Label>Telefoon</Label>
                <Input
                  autoComplete="tel"
                  fullWidth
                  name="phone"
                  placeholder="06 12345678"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <div className="field-stack">
                <Label>Landcode</Label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    name="phoneCountry"
                    value={phoneCountry}
                    onChange={(event) => setPhoneCountry(event.target.value as typeof phoneCountry)}
                  >
                    {phoneCountryOptions.map((country) => (
                      <NativeSelect.Option key={country} value={country}>
                        {country}
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <div className="field-stack">
                <Label>Contract</Label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    name="membershipPlanId"
                    value={membershipPlanId}
                    onChange={(event) => setMembershipPlanId(event.target.value)}
                  >
                    {snapshot.membershipPlans.map((plan) => (
                      <NativeSelect.Option key={plan.id} value={plan.id}>
                        {plan.name} · EUR {plan.priceMonthly}/mnd
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <div className="field-stack">
                <Label>Vestiging</Label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    name="preferredLocationId"
                    value={preferredLocationId}
                    onChange={(event) => setPreferredLocationId(event.target.value)}
                  >
                    {snapshot.locations.map((location) => (
                      <NativeSelect.Option key={location.id} value={location.id}>
                        {location.name} · {location.city}
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <div className="field-stack">
                <Label>Betaalmethode</Label>
                <NativeSelect fullWidth>
                  <NativeSelect.Trigger
                    name="paymentMethod"
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}
                  >
                    <NativeSelect.Option value="direct_debit">Automatische incasso</NativeSelect.Option>
                    <NativeSelect.Option value="one_time">Eenmalige betaling (hele contractduur)</NativeSelect.Option>
                    <NativeSelect.Option value="payment_request">Betaalverzoek</NativeSelect.Option>
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <div className="field-stack">
                <Label>Ledenportaalwachtwoord</Label>
                <Input
                  autoComplete="new-password"
                  fullWidth
                  name="portalPassword"
                  placeholder="Minimaal 8 tekens"
                  type="password"
                  value={portalPassword}
                  onChange={(event) => setPortalPassword(event.target.value)}
                />
              </div>
              <div className="field-stack md:col-span-2">
                <Label>Opmerking</Label>
                <Input
                  fullWidth
                  name="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
              <div className="md:col-span-2 space-y-3">
                <Checkbox isSelected={contractAccepted} onChange={setContractAccepted}>
                  Ik accepteer het contract en de voorwaarden.
                </Checkbox>
                <Checkbox isSelected={waiverAccepted} onChange={setWaiverAccepted}>
                  Ik bevestig de intake/waiver voor veilige deelname.
                </Checkbox>
                <p className="text-muted text-sm">
                  {termsUrl || privacyUrl ? (
                    <>
                      Voorwaarden:{" "}
                      {termsUrl ? (
                        <a
                          href={termsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-4"
                        >
                          bekijken
                        </a>
                      ) : (
                        "volgen via de club"
                      )}{" "}
                      · Privacy:{" "}
                      {privacyUrl ? (
                        <a
                          href={privacyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-4"
                        >
                          bekijken
                        </a>
                      ) : (
                        "volgt via de club"
                      )}
                    </>
                  ) : (
                    "De club deelt de voorwaarden en privacyinformatie voordat je aanmelding definitief wordt."
                  )}
                </p>
                <p className="text-muted text-sm">
                  {snapshot.billingMessage}
                </p>
                <p className="text-muted text-sm">
                  {snapshot.legalMessage}
                </p>
                {checkoutDisabledReason ? (
                  <p className="text-muted text-sm">
                    {checkoutDisabledReason}
                  </p>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <Button
                  isDisabled={isPending || !signupReady}
                  type="submit"
                >
                  {isPending ? "Checkout starten..." : "Checkout starten"}
                </Button>
              </div>
            </Card.Content>
          </form>
        </Card>
      )}
    </div>
  );
}
