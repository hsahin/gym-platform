"use client";

import type { ReactNode } from "react";
import { Button as HeroButton, Card as HeroCard, Chip } from "@heroui/react";
import { HeroPhoneNumberField, type HeroPhoneNumberFieldProps } from "@/components/HeroPhoneNumberField";

function cx(...values: Array<string | undefined | false | null>) {
  return values.filter(Boolean).join(" ");
}

function mapButtonVariant(variant?: string) {
  switch (variant) {
    case "outline":
      return "outline";
    case "secondary":
      return "secondary";
    case "ghost":
      return "ghost";
    case "destructive":
      return "danger";
    default:
      return "primary";
  }
}

function mapChipColor(variant?: string) {
  switch (variant) {
    case "warning":
      return "warning";
    case "destructive":
      return "danger";
    case "success":
      return "success";
    case "info":
      return "accent";
    default:
      return "default";
  }
}

function mapChipVariant(variant?: string) {
  switch (variant) {
    case "outline":
      return "tertiary";
    case "secondary":
      return "soft";
    default:
      return "soft";
  }
}

export function Button({
  children,
  className,
  disabled,
  onClick,
  variant,
  ...props
}: {
  readonly children?: ReactNode;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly onClick?: (event: unknown) => void;
  readonly type?: "button" | "submit" | "reset";
  readonly variant?: string;
}) {
  return (
    <HeroButton
      className={className}
      isDisabled={disabled}
      variant={mapButtonVariant(variant)}
      onPress={(event) => {
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </HeroButton>
  );
}

export function Badge({
  children,
  className,
  variant,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly variant?: string;
}) {
  return (
    <Chip
      className={className}
      color={mapChipColor(variant)}
      size="sm"
      variant={mapChipVariant(variant)}
    >
      {children}
    </Chip>
  );
}

export function Card({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return <HeroCard className={cx("rounded-2xl", className)}>{children}</HeroCard>;
}

export function CardHeader({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return <HeroCard.Header className={className}>{children}</HeroCard.Header>;
}

export function CardContent({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return <HeroCard.Content className={className}>{children}</HeroCard.Content>;
}

export function CardTitle({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return <HeroCard.Title className={className}>{children}</HeroCard.Title>;
}

export function PhoneNumberField(props: HeroPhoneNumberFieldProps) {
  return <HeroPhoneNumberField {...props} />;
}
