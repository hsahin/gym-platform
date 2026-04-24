"use client";

import { Input, Label } from "@heroui/react";
import { NativeSelect } from "@heroui-pro/react/native-select";

const COUNTRY_OPTIONS = [
  { code: "NL", label: "NL +31" },
  { code: "BE", label: "BE +32" },
  { code: "DE", label: "DE +49" },
  { code: "FR", label: "FR +33" },
  { code: "GB", label: "GB +44" },
  { code: "US", label: "US +1" },
] as const;

export interface HeroPhoneNumberFieldProps {
  readonly country: string;
  readonly onCountryChange: (value: string) => void;
  readonly phone: string;
  readonly onPhoneChange: (value: string) => void;
  readonly countryLabel?: string;
  readonly phoneLabel?: string;
  readonly language?: string;
}

export function HeroPhoneNumberField({
  country,
  onCountryChange,
  phone,
  onPhoneChange,
  countryLabel = "Landcode",
  phoneLabel = "Mobiel nummer",
}: HeroPhoneNumberFieldProps) {
  return (
    <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
      <div className="field-stack">
        <Label>{countryLabel}</Label>
        <NativeSelect fullWidth>
          <NativeSelect.Trigger
            name="phoneCountry"
            value={country}
            onChange={(event) => onCountryChange(event.target.value)}
          >
            {COUNTRY_OPTIONS.map((option) => (
              <NativeSelect.Option key={option.code} value={option.code}>
                {option.label}
              </NativeSelect.Option>
            ))}
            <NativeSelect.Indicator />
          </NativeSelect.Trigger>
        </NativeSelect>
      </div>

      <div className="field-stack">
        <Label>{phoneLabel}</Label>
        <Input
          fullWidth
          autoComplete="tel"
          inputMode="tel"
          placeholder="06 12345678"
          value={phone}
          onChange={(event) => onPhoneChange(event.target.value)}
        />
      </div>
    </div>
  );
}
