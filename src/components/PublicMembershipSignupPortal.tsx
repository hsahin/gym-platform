"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Card, Description, Input, Label } from "@heroui/react";
import { CheckboxButtonGroup } from "@heroui-pro/react/checkbox-button-group";
import { RadioButtonGroup } from "@heroui-pro/react/radio-button-group";
import { Button } from "@/components/dashboard/HydrationSafeButton";
import { NativeSelect } from "@/components/dashboard/HydrationSafeNativeSelect";
import { toast } from "sonner";
import { buildMutationHeaders } from "@/lib/mutation-security-client";
import {
  getMembershipBillingCycleLabel,
  getMembershipBillingCycleMonths,
} from "@/lib/memberships";
import type { PublicMembershipSignupPortalSnapshot } from "@/lib/public-membership-signup-view";

declare global {
  interface Window {
    Capacitor?: {
      Plugins?: {
        Browser?: {
          open(options: { readonly url: string; readonly presentationStyle?: "fullscreen" }): Promise<void>;
        };
      };
    };
  }
}

type SignupAgreement = "contract" | "waiver" | "sepa";
type SignupPaymentMethod = "direct_debit" | "one_time";

const paymentMethodOptions: ReadonlyArray<{
  readonly description: string;
  readonly label: string;
  readonly value: SignupPaymentMethod;
}> = [
  {
    value: "direct_debit",
    label: "Automatische incasso",
    description: "Maandelijks automatisch via veilige incasso.",
  },
  {
    value: "one_time",
    label: "Volledige contractbetaling",
    description: "Betaal de volledige contractperiode in één keer.",
  },
] as const;

function formatMonthlyPrice(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    currency: "EUR",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    style: "currency",
  }).format(value);
}

function formatEuroFromCents(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    currency: "EUR",
    style: "currency",
  }).format(value / 100);
}

function getFullPaymentAmountCents(
  plan: PublicMembershipSignupPortalSnapshot["membershipPlans"][number] | undefined,
) {
  if (!plan) {
    return 0;
  }

  const gross = Math.round(plan.priceMonthly * getMembershipBillingCycleMonths(plan.billingCycle) * 100);
  const discount = Math.min(100, Math.max(0, plan.fullPaymentDiscountPercent ?? 0));

  return Math.max(0, Math.round(gross * (1 - discount / 100)));
}

export interface PublicSignupPaymentReturnState {
  readonly isReturn: boolean;
  readonly invoiceId?: string | null;
}

export function PublicMembershipSignupPortal({
  paymentReturn,
  snapshot,
}: {
  readonly paymentReturn?: PublicSignupPaymentReturnState;
  readonly snapshot: PublicMembershipSignupPortalSnapshot;
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
  const [paymentMethod, setPaymentMethod] =
    useState<SignupPaymentMethod>("direct_debit");
  const [signupAgreements, setSignupAgreements] = useState<SignupAgreement[]>([]);
  const [iban, setIban] = useState("");
  const [portalPassword, setPortalPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [signupOutcome, setSignupOutcome] = useState<{
    readonly title: string;
    readonly description: string;
  } | null>(null);
  const termsUrl = snapshot.legal.termsUrl?.trim() ?? "";
  const privacyUrl = snapshot.legal.privacyUrl?.trim() ?? "";
  const clubSignupAvailable = snapshot.checkoutAvailable;
  const selectedPlan = snapshot.membershipPlans.find((plan) => plan.id === membershipPlanId);
  const availablePaymentMethodOptions = paymentMethodOptions.filter((option) =>
    snapshot.paymentMethods.includes(option.value),
  );
  const fullPaymentAmountCents = getFullPaymentAmountCents(selectedPlan);
  const contractAccepted = signupAgreements.includes("contract");
  const waiverAccepted = signupAgreements.includes("waiver");
  const sepaMandateAccepted =
    paymentMethod !== "direct_debit" || signupAgreements.includes("sepa");
  const memberMissingFields = [
    fullName.trim() ? null : "naam",
    email.trim() ? null : "e-mail",
    phone.trim() ? null : "telefoon",
    snapshot.membershipPlans.length > 0 && !membershipPlanId ? "lidmaatschap" : null,
    snapshot.locations.length > 0 && !preferredLocationId ? "vestiging" : null,
    portalPassword.trim().length >= 8 ? null : "portal wachtwoord",
    paymentMethod === "direct_debit" && !iban.trim() ? "IBAN" : null,
    contractAccepted ? null : "contractakkoord",
    waiverAccepted ? null : "waiverakkoord",
    sepaMandateAccepted ? null : "SEPA machtiging",
  ].filter((field): field is string => Boolean(field));
  const memberFormReady = memberMissingFields.length === 0;
  const signupReady = Boolean(
    clubSignupAvailable && availablePaymentMethodOptions.length > 0 && memberFormReady,
  );
  const checkoutDisabledReason = isPending
    ? "Even wachten: je aanmelding wordt verwerkt."
    : !clubSignupAvailable
      ? "Online inschrijven is nog niet beschikbaar bij deze club. Probeer later opnieuw of neem contact op met de club."
      : availablePaymentMethodOptions.length === 0
        ? "Online inschrijven heeft nog geen betaalwijze. Neem contact op met de club."
      : !memberFormReady
        ? "Vul je gegevens in en accepteer de voorwaarden voordat je doorgaat."
      : null;

  async function openSignupCheckout(checkoutUrl: string) {
    const nativeBrowser = window.Capacitor?.Plugins?.Browser;

    if (nativeBrowser?.open) {
      try {
        await nativeBrowser.open({ url: checkoutUrl, presentationStyle: "fullscreen" });
        return;
      } catch {
        toast.error("Betaling kon niet worden geopend. We proberen je browser te gebruiken.");
      }
    }

    // Web: stay in the same tab so we don't double-launch the checkout.
    window.location.assign(checkoutUrl);
  }

  function submitSignup() {
    if (isPending || !signupReady) {
      return;
    }

    startTransition(async () => {
      try {
        setSignupOutcome(null);
        const response = await fetch("/api/public/member-signups", {
          method: "POST",
          headers: await buildMutationHeaders(),
          body: JSON.stringify({
            tenantSlug: snapshot.tenantSlug ?? undefined,
            fullName,
            email,
            phone,
            phoneCountry,
            membershipPlanId,
            preferredLocationId,
            paymentMethod,
            iban: paymentMethod === "direct_debit" ? iban : undefined,
            sepaMandateAccepted,
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
        setIban("");
        setPortalPassword("");
        setNotes("");
        setSignupAgreements([]);
        if (payload.data?.checkoutUrl) {
          setSignupOutcome({
            title: "Je betaling wordt geopend",
            description:
              "Rond de volledige contractbetaling af. Daarna verwerkt de club je lidmaatschap automatisch.",
          });
          toast.success("Betaling gestart. Je wordt doorgestuurd naar de betaling.");
          await openSignupCheckout(payload.data.checkoutUrl);
          return;
        }

        setSignupOutcome({
          title: "Je aanmelding is ontvangen",
          description:
            "Je SEPA machtiging is vastgelegd. De club kan je maandelijkse incasso nu automatisch verwerken.",
        });
        toast.success("Aanmelding ontvangen. Je automatische incasso staat klaar.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Aanmelding mislukt.");
      }
    });
  }

  useEffect(() => {
    setMembershipPlanId(snapshot.membershipPlans[0]?.id ?? "");
    setPreferredLocationId(snapshot.locations[0]?.id ?? "");
  }, [snapshot.locations, snapshot.membershipPlans]);

  useEffect(() => {
    if (
      availablePaymentMethodOptions.length > 0 &&
      !availablePaymentMethodOptions.some((option) => option.value === paymentMethod)
    ) {
      setPaymentMethod(availablePaymentMethodOptions[0]!.value);
    }
  }, [availablePaymentMethodOptions, paymentMethod]);

  useEffect(() => {
    if (paymentMethod !== "direct_debit" && signupAgreements.includes("sepa")) {
      setSignupAgreements((current) => current.filter((item) => item !== "sepa"));
    }
  }, [paymentMethod, signupAgreements]);

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
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {snapshot.availableGyms.map((gym) => (
            <Link
              key={gym.id}
              href={`/join?gym=${gym.slug}`}
              className="focus-visible:outline-accent rounded-[28px] focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <Card className="border-border/80 rounded-[28px] transition hover:border-foreground/30">
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
              Kies je lidmaatschap en betaalwijze. Bij incasso geef je een SEPA machtiging af;
              bij volledige contractbetaling open je de betaling voor de hele contractduur.
            </Card.Description>
          </Card.Header>
          {paymentReturn?.isReturn ? (
            <div className="mx-6 mb-4 rounded-2xl border border-border bg-surface-secondary p-4 md:mx-8">
              <p className="text-sm font-semibold">Je betaling wordt verwerkt</p>
              <p className="text-muted mt-1 max-w-2xl text-sm leading-6">
                Je aanmelding is ontvangen. Zodra de betaling door de bank is bevestigd, rondt de club je
                lidmaatschap en ledenportaal automatisch af.
              </p>
            </div>
          ) : null}
          {signupOutcome ? (
            <div className="mx-6 mb-4 rounded-2xl border border-success/30 bg-success/10 p-4 md:mx-8">
              <p className="text-sm font-semibold">{signupOutcome.title}</p>
              <p className="text-muted mt-1 max-w-2xl text-sm leading-6">
                {signupOutcome.description}
              </p>
            </div>
          ) : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitSignup();
            }}
          >
            <Card.Content className="space-y-7">
              <section className="grid gap-4 md:grid-cols-2">
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
                  <NativeSelect fullWidth variant="secondary">
                    <Label>Landcode</Label>
                    <NativeSelect.Trigger
                      name="phoneCountry"
                      value={phoneCountry}
                      onChange={(event) =>
                        setPhoneCountry(event.target.value as typeof phoneCountry)
                      }
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
                  <NativeSelect fullWidth variant="secondary">
                    <Label>Vestiging</Label>
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
              </section>

              <RadioButtonGroup
                className="w-full grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                layout="grid"
                name="membershipPlanId"
                value={membershipPlanId}
                variant="secondary"
                onChange={(value) => setMembershipPlanId(String(value))}
              >
                <Label className="col-span-full">Kies je lidmaatschap</Label>
                <Description className="col-span-full">
                  Selecteer het contract waarmee je direct wilt starten.
                </Description>
                {snapshot.membershipPlans.map((plan) => (
                  <RadioButtonGroup.Item key={plan.id} value={plan.id}>
                    <RadioButtonGroup.Indicator />
                    <RadioButtonGroup.ItemContent>
                      <Label>{plan.name}</Label>
                      <Description>
                        {getMembershipBillingCycleLabel(plan.billingCycle)}
                      </Description>
                      <span className="mt-2 text-lg font-semibold">
                        {formatMonthlyPrice(plan.priceMonthly)}
                        <span className="text-muted text-sm font-normal"> / maand</span>
                      </span>
                      {plan.fullPaymentDiscountPercent > 0 ? (
                        <span className="mt-2 inline-flex w-fit rounded-full bg-success/10 px-2 py-1 text-xs font-medium text-success">
                          {plan.fullPaymentDiscountPercent}% korting bij volledige contractbetaling
                        </span>
                      ) : null}
                    </RadioButtonGroup.ItemContent>
                  </RadioButtonGroup.Item>
                ))}
              </RadioButtonGroup>

              <RadioButtonGroup
                className="w-full grid-cols-1 md:grid-cols-3"
                layout="grid"
                name="paymentMethod"
                value={paymentMethod}
                variant="secondary"
                onChange={(value) => setPaymentMethod(value as SignupPaymentMethod)}
              >
                <Label className="col-span-full">Betaalmethode</Label>
                <Description className="col-span-full">
                  Kies hoe je dit lidmaatschap wilt betalen.
                </Description>
                {availablePaymentMethodOptions.map((option) => (
                  <RadioButtonGroup.Item key={option.value} value={option.value}>
                    <RadioButtonGroup.Indicator />
                    <RadioButtonGroup.ItemContent>
                      <Label>{option.label}</Label>
                      <Description>
                        {option.value === "one_time" && selectedPlan
                          ? `${option.description} Totaal: ${formatEuroFromCents(fullPaymentAmountCents)}.`
                          : option.description}
                      </Description>
                    </RadioButtonGroup.ItemContent>
                  </RadioButtonGroup.Item>
                ))}
              </RadioButtonGroup>

              {paymentMethod === "direct_debit" ? (
                <section className="grid gap-4 rounded-2xl border border-border bg-surface-secondary p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                  <div className="field-stack">
                    <Label>IBAN voor automatische incasso</Label>
                    <Input
                      autoComplete="off"
                      fullWidth
                      name="iban"
                      placeholder="NL91 ABNA 0417 1643 00"
                      value={iban}
                      onChange={(event) => setIban(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">SEPA machtiging</p>
                    <p className="text-muted leading-6">
                      {snapshot.legal.sepaMandateText ||
                        "Je machtigt de club om je lidmaatschap maandelijks via SEPA-incasso te innen."}
                    </p>
                  </div>
                </section>
              ) : null}

              <div className="field-stack">
                <Label>Opmerking</Label>
                <Input
                  fullWidth
                  name="notes"
                  placeholder="Bijvoorbeeld blessure, proefles of voorkeur"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>

              <section className="space-y-4">
                <CheckboxButtonGroup
                  className={`w-full grid-cols-1 ${paymentMethod === "direct_debit" ? "md:grid-cols-3" : "md:grid-cols-2"}`}
                  layout="grid"
                  name="signupAgreements"
                  value={signupAgreements}
                  variant="secondary"
                  onChange={(value) => setSignupAgreements(value as SignupAgreement[])}
                >
                  <Label className="col-span-full">Bevestigen en doorgaan</Label>
                  <Description className="col-span-full">
                    Vink de kaarten aan zodat we je inschrijving veilig kunnen afronden.
                  </Description>
                  <CheckboxButtonGroup.Item key="contract" value="contract">
                    <CheckboxButtonGroup.Indicator />
                    <CheckboxButtonGroup.ItemContent>
                      <Label>Contract en voorwaarden</Label>
                      <Description>
                        Ik accepteer het contract en de voorwaarden.
                      </Description>
                    </CheckboxButtonGroup.ItemContent>
                  </CheckboxButtonGroup.Item>
                  <CheckboxButtonGroup.Item key="waiver" value="waiver">
                    <CheckboxButtonGroup.Indicator />
                    <CheckboxButtonGroup.ItemContent>
                      <Label>Intake en waiver</Label>
                      <Description>
                        Ik bevestig de intake/waiver voor veilige deelname.
                      </Description>
                    </CheckboxButtonGroup.ItemContent>
                  </CheckboxButtonGroup.Item>
                  {paymentMethod === "direct_debit" ? (
                    <CheckboxButtonGroup.Item key="sepa" value="sepa">
                      <CheckboxButtonGroup.Indicator />
                      <CheckboxButtonGroup.ItemContent>
                        <Label>SEPA machtiging</Label>
                        <Description>
                          Ik geef toestemming voor maandelijkse automatische incasso.
                        </Description>
                      </CheckboxButtonGroup.ItemContent>
                    </CheckboxButtonGroup.Item>
                  ) : null}
                </CheckboxButtonGroup>

                {termsUrl || privacyUrl ? (
                  <p className="text-muted text-sm">
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
                      "via de club"
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
                      "via de club"
                    )}
                  </p>
                ) : null}
                {checkoutDisabledReason ? (
                  <p className="text-muted text-sm">
                    {checkoutDisabledReason}
                  </p>
                ) : null}
              </section>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted max-w-xl text-sm leading-6">
                  {paymentMethod === "direct_debit"
                    ? "Na je SEPA machtiging staan je lidmaatschap, contract en ledenportaal klaar."
                    : "Na je volledige contractbetaling staan je lidmaatschap, contract en ledenportaal klaar."}
                </p>
                <Button
                  fullWidth
                  isDisabled={isPending || !signupReady}
                  className="sm:w-auto"
                  type="submit"
                >
                  {isPending
                    ? "Aanmelding verwerken..."
                    : paymentMethod === "direct_debit"
                      ? "SEPA machtiging afgeven"
                      : "Betaling starten"}
                </Button>
              </div>
            </Card.Content>
          </form>
        </Card>
      )}
    </div>
  );
}
