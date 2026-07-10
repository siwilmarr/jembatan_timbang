/**
 * CAS CI-2001A Frame Builder
 *
 * Bertugas membangun string data yang menyerupai output indikator CAS.
 *
 * Contoh:
 * ST GS +003500kg
 * US GS +003500kg
 * ST NT +001200kg
 * ST OL +999999kg
 */

function formatWeight(weight) {
  const value = Math.round(weight);

  return String(Math.abs(value))
    .padStart(6, "0");
}

export function buildCasFrame({
  weight = 0,
  stable = false,
  mode = "GS",
  overload = false,
}) {
  const stability = stable ? "ST" : "US";

  if (overload) {
    return `ST OL +999999kg\r\n`;
  }

  const sign = weight >= 0 ? "+" : "-";

  const formatted = formatWeight(weight);

  return `${stability} ${mode} ${sign}${formatted}kg\r\n`;
}