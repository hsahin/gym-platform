"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Button, Card, Checkbox, Input, Label } from "@heroui/react";
import { NativeSelect } from "@heroui-pro/react/native-select";
import { toast } from "sonner";
import { MUTATION_CSRF_TOKEN } from "@/server/http/platform-api";
import type { PublicMembershipSignupSnapshot } from "@/server/types";

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
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setMembershipPlanId(snapshot.membershipPlans[0]?.id ?? "");
    setPreferredLocationId(snapshot.locations[0]?.id ?? "");
  }, [snapshot.locations, snapshot.membershipPlans]);

  return (
    <div className="section-stack py-6 md:py-8">
      <header className="app-header">
        <div className="app-header__brand-copy">
          <p className="text-sm font-semibold">Join the gym</p>
          <p className="text-muted text-sm">
            {snapshot.tenantSlug ? snapshot.tenantName : "Kies eerst je club"}
          </p>
        </div>
        <nav className="app-header__nav text-sm">
          <Link href="/" prefetch={false} className="text-muted transition hover:text-foreground">
            Home
          </Link>
          <Link href="/login" prefetch={false} className="text-muted transition hover:text-foreground">
            Login
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
                  <Card.Description>Open de publieke aanmeldflow voor deze club.</Card.Description>
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
              Kies je contract, bevestig je waiver en dien je aanmelding in. De owner rondt daarna
              je onboarding af.
            </Card.Description>
          </Card.Header>
          <Card.Content className="grid gap-4 md:grid-cols-2">
            <div className="field-stack">
              <Label>Naam</Label>
              <Input fullWidth value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </div>
            <div className="field-stack">
              <Label>E-mail</Label>
              <Input fullWidth type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="field-stack">
              <Label>Telefoon</Label>
              <Input fullWidth value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
            <div className="field-stack">
              <Label>Landcode</Label>
              <NativeSelect fullWidth>
                <NativeSelect.Trigger value={phoneCountry} onChange={(event) => setPhoneCountry(event.target.value as typeof phoneCountry)}>
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
                <NativeSelect.Trigger value={membershipPlanId} onChange={(event) => setMembershipPlanId(event.target.value)}>
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
                <NativeSelect.Trigger value={preferredLocationId} onChange={(event) => setPreferredLocationId(event.target.value)}>
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
              <Label>Checkout methode</Label>
              <NativeSelect fullWidth>
                <NativeSelect.Trigger value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}>
                  <NativeSelect.Option value="direct_debit">Direct debit</NativeSelect.Option>
                  <NativeSelect.Option value="one_time">Eenmalige betaling</NativeSelect.Option>
                  <NativeSelect.Option value="payment_request">Betaalverzoek</NativeSelect.Option>
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
            </div>
            <div className="field-stack md:col-span-2">
              <Label>Opmerking</Label>
              <Input fullWidth value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
            <div className="md:col-span-2 space-y-3">
              <Checkbox isSelected={contractAccepted} onChange={setContractAccepted}>
                Ik accepteer het contract en de voorwaarden.
              </Checkbox>
              <Checkbox isSelected={waiverAccepted} onChange={setWaiverAccepted}>
                Ik bevestig de intake/waiver voor veilige deelname.
              </Checkbox>
              <p className="text-muted text-sm">
                Voorwaarden: {snapshot.legal.termsUrl || "nog niet ingevuld"} · Privacy:{" "}
                {snapshot.legal.privacyUrl || "nog niet ingevuld"}
              </p>
              <p className="text-muted text-sm">
                {snapshot.billingReady
                  ? "Je checkout wordt doorgezet naar billing zodra de owner je aanvraag goedkeurt."
                  : "Billing staat nog niet live; je aanvraag komt eerst bij de owner voor handmatige opvolging."}
              </p>
            </div>
            <div className="md:col-span-2">
              <Button
                isDisabled={isPending || !snapshot.tenantSlug}
                onPress={() =>
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
                      setNotes("");
                      setContractAccepted(false);
                      setWaiverAccepted(false);
                      toast.success("Aanmelding ontvangen. De owner beoordeelt deze nu.");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Aanmelding mislukt.");
                    }
                  })
                }
              >
                {isPending ? "Versturen..." : "Dien aanmelding in"}
              </Button>
            </div>
          </Card.Content>
        </Card>
      )}
    </div>
  );
}
