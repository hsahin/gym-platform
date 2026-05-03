export function formatEuroFromCents(amountCents: number) {
  const safeAmountCents = Number.isFinite(amountCents) ? amountCents : 0;
  const amount = safeAmountCents / 100;

  return `€ ${amount.toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function parseEuroInputToCents(input: string) {
  const normalizedInput = input
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!normalizedInput) {
    return 0;
  }

  const lastComma = normalizedInput.lastIndexOf(",");
  const lastDot = normalizedInput.lastIndexOf(".");
  const decimalSeparatorIndex = Math.max(lastComma, lastDot);
  const separatorCount = [...normalizedInput].filter(
    (character) => character === "," || character === ".",
  ).length;

  if (decimalSeparatorIndex === -1) {
    const euros = Number(normalizedInput.replace(/[^\d-]/g, ""));
    return Number.isFinite(euros) ? Math.round(euros * 100) : 0;
  }

  const fractionDigits = normalizedInput
    .slice(decimalSeparatorIndex + 1)
    .replace(/\D/g, "");

  if (separatorCount === 1 && fractionDigits.length > 2) {
    const euros = Number(normalizedInput.replace(/[^\d-]/g, ""));
    return Number.isFinite(euros) ? Math.round(euros * 100) : 0;
  }

  const eurosPart = normalizedInput
    .slice(0, decimalSeparatorIndex)
    .replace(/[^\d-]/g, "");
  const centsPart = fractionDigits
    .padEnd(2, "0")
    .slice(0, 2);
  const parsedAmount = Number(`${eurosPart || "0"}.${centsPart || "00"}`);

  return Number.isFinite(parsedAmount) ? Math.round(parsedAmount * 100) : 0;
}
