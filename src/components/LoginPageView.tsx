"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Chip, Input, Label } from "@heroui/react";
import { Button } from "@/components/dashboard/HydrationSafeButton";
import { Segment } from "@/components/dashboard/HydrationSafeSegment";
import { LazyThemeModeSwitch } from "@/components/theme/LazyThemeModeSwitch";

export function LoginPageView({
  isSetupComplete,
  loginError,
  mode,
  roleLabel,
  setupError,
}: {
  readonly isSetupComplete: boolean;
  readonly loginError?: string;
  readonly mode: "login" | "signup";
  readonly roleLabel?: string;
  readonly setupError?: string;
}) {
  const router = useRouter();

  return (
    <main className="app-page section-stack min-h-screen py-6 md:py-8">
      <header className="app-header">
        <div className="app-header__brand">
          <Link
            href="/"
            className="app-surface flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-semibold"
          >
            G
          </Link>
          <div className="app-header__brand-copy">
            <p className="text-sm font-semibold">GymOS</p>
            <p className="text-muted text-sm">
              Toegang voor eigenaars, medewerkers en leden.
            </p>
          </div>
        </div>

        <div className="app-header__actions">
          <nav className="app-header__nav text-sm">
            <Link href="/" prefetch={false} className="text-muted transition hover:text-foreground">
              Start
            </Link>
            <Link
              href="/pricing"
              prefetch={false}
              className="text-muted transition hover:text-foreground"
            >
              Prijzen
            </Link>
            <Link
              href="/reserve"
              prefetch={false}
              className="text-muted transition hover:text-foreground"
            >
              Reserveren
            </Link>
          </nav>
          <LazyThemeModeSwitch />
        </div>
      </header>

      <section className="mx-auto w-full max-w-[32rem]">
        <Card className="rounded-[32px] border-border/80">
          <Card.Header className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Chip size="sm" variant="soft">
                {mode === "login" ? "Accounttoegang" : "Nieuwe gym"}
              </Chip>
              {roleLabel ? (
                <Chip size="sm" variant="tertiary">
                  Actieve sessie: {roleLabel}
                </Chip>
              ) : null}
            </div>
            <div className="space-y-3">
              <Card.Title className="text-2xl md:text-3xl">
                {mode === "login"
                  ? "Log in op je account."
                  : "Maak je eerste sportschool aan."}
              </Card.Title>
              <Card.Description className="max-w-xl text-base">
                {mode === "login"
                  ? "Eigenaars, medewerkers en clubleden gebruiken hier hetzelfde inlogpunt."
                  : "Hiermee maak je het eigenaarsaccount en de gymbasis aan. De rest van de inrichting gebeurt daarna in het dashboard."}
              </Card.Description>
            </div>
          </Card.Header>

          <Card.Content className="section-stack">
            {isSetupComplete ? (
              <Segment
                onSelectionChange={(key) => {
                  const nextMode = String(key);
                  router.push(nextMode === "signup" ? "/login?mode=signup" : "/login");
                }}
                selectedKey={mode}
                size="sm"
              >
                <Segment.Item id="login">
                  <Segment.Separator />
                  Inloggen
                </Segment.Item>
                <Segment.Item id="signup">
                  <Segment.Separator />
                  Nieuwe gym
                </Segment.Item>
              </Segment>
            ) : null}

            {mode === "login" && isSetupComplete ? (
              <form action="/api/auth/login" className="section-stack" method="post">
                <div className="field-stack">
                  <Label>E-mailadres</Label>
                  <Input
                    autoComplete="username"
                    fullWidth
                    name="email"
                    placeholder="owner@jouwgym.nl"
                    required
                    type="email"
                  />
                </div>

                <div className="field-stack">
                  <Label>Wachtwoord</Label>
                  <Input
                    autoComplete="current-password"
                    fullWidth
                    minLength={8}
                    name="password"
                    placeholder="Minimaal 8 tekens"
                    required
                    type="password"
                  />
                </div>

                {loginError ? (
                  <Card className="rounded-2xl border-danger/20 bg-danger/5">
                    <Card.Content>
                      <p className="text-danger text-sm">{loginError}</p>
                    </Card.Content>
                  </Card>
                ) : null}

                <Button type="submit">Inloggen</Button>
              </form>
            ) : (
              <form action="/api/auth/setup" className="section-stack" method="post">
                <div className="field-stack">
                  <Label>Naam sportschool</Label>
                  <Input
                    autoComplete="organization"
                    fullWidth
                    name="tenantName"
                    placeholder="Jouw sportschool"
                    required
                  />
                </div>

                <div className="field-stack">
                  <Label>Naam eigenaar</Label>
                  <Input
                    autoComplete="name"
                    fullWidth
                    name="ownerName"
                    placeholder="Naam eigenaar"
                    required
                  />
                </div>

                <div className="field-stack">
                  <Label>E-mailadres eigenaar</Label>
                  <Input
                    autoComplete="username"
                    fullWidth
                    name="ownerEmail"
                    placeholder="eigenaar@jouwgym.nl"
                    required
                    type="email"
                  />
                </div>

                <div className="field-stack">
                  <Label>Wachtwoord</Label>
                  <Input
                    autoComplete="new-password"
                    fullWidth
                    minLength={8}
                    name="password"
                    placeholder="Minimaal 8 tekens"
                    required
                    type="password"
                  />
                </div>

                {setupError ? (
                  <Card className="rounded-2xl border-danger/20 bg-danger/5">
                    <Card.Content>
                      <p className="text-danger text-sm">{setupError}</p>
                    </Card.Content>
                  </Card>
                ) : null}

                <Button type="submit">Sportschool aanmaken</Button>
              </form>
            )}
          </Card.Content>
        </Card>
      </section>
    </main>
  );
}
