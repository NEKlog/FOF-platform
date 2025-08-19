// Slører mails/telefon i tekst – brug i offentlige endpoints
export function redactPII(s: string): string {
  if (!s) return s;
  let out = s;
  // email
  out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "✱✱✱@✱✱✱");
  // telefon (DK: 8 cifre, også formateret)
  out = out.replace(/\b(?:\+?45[-\s]?)?(\d{2}[-\s]?\d{2}[-\s]?\d{2}[-\s]?\d{2})\b/g, "✱✱✱✱✱✱✱✱");
  return out;
}
