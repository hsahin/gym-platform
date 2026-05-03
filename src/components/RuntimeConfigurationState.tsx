"use client";

import Link from "next/link";
import { Card, Chip } from "@heroui/react";
import { ThemeModeSwitch } from "@/components/theme/ThemeModeSwitch";

export function RuntimeConfigurationState({
  detail,
  title = "Live systeemconfiguratie ontbreekt",
}: {
  readonly detail: string;
  readonly title?: string;
}) {
  return (
    <main className="app-page section-stack min-h-screen py-8">
      <header className="app-header">
        <div className="app-header__brand-copy">
          <p className="text-sm font-semibold">GymOS</p>
          <p className="text-muted text-sm">Lokale omgeving zonder tijdelijke fallback.</p>
        </div>
        <div className="app-header__actions">
          <nav className="app-header__nav text-sm">
            <Link href="/" className="text-muted transition hover:text-foreground">
              Start
            </Link>
            <Link href="/login" className="text-muted transition hover:text-foreground">
              Inloggen
            </Link>
          </nav>
          <ThemeModeSwitch />
        </div>
      </header>

      <Card className="mx-auto w-full max-w-2xl rounded-[32px] border-border/80">
        <Card.Header className="space-y-3">
          <Chip size="sm" variant="soft">
            Systeemconfiguratie
          </Chip>
          <Card.Title>{title}</Card.Title>
          <Card.Description>
            Deze omgeving mist de verbindingen die nodig zijn om de bestaande flows correct te laden.
          </Card.Description>
        </Card.Header>
        <Card.Content className="section-stack">
          <Card className="rounded-2xl border-warning/20 bg-warning/5">
            <Card.Content>
              <p className="text-sm text-warning-700 dark:text-warning-300">{detail}</p>
            </Card.Content>
          </Card>
          <p className="text-muted text-sm">
            Zet de live variabelen in <code>.env.local</code> zodat localhost dezelfde
            backends gebruikt als de DigitalOcean app.
          </p>
        </Card.Content>
      </Card>
    </main>
  );
}
