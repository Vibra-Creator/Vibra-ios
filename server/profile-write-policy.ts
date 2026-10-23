import type { Profile } from "@shared/schema";

export function validateProfileWrite(
  existing: Pick<Profile, "age" | "imageUrl">,
  change: { age?: number; imageUrl?: string | null; photos?: unknown },
  expected: { expectedAge?: unknown; expectedImageUrl?: unknown },
): string | null {
  if (change.age !== undefined) {
    if (!Number.isInteger(change.age) || change.age < 18 || change.age > 120) return "Inserisci un'età valida tra 18 e 120 anni.";
    if (change.age !== existing.age && expected.expectedAge !== existing.age) {
      return "L'età del profilo è cambiata o il modulo non è aggiornato. Ricarica il profilo prima di salvare.";
    }
  }
  if (change.photos !== undefined) return "Usa i comandi della galleria per modificare le foto.";
  if (change.imageUrl !== undefined && change.imageUrl !== existing.imageUrl) {
    if (expected.expectedImageUrl !== existing.imageUrl) return "La foto principale è cambiata. Ricarica il profilo prima di salvare.";
    const isDefault = (value: string | null) => !value || /\/images\/(?:avatar|profile-)/i.test(value);
    if (!isDefault(existing.imageUrl) && isDefault(change.imageUrl)) {
      return "La foto salvata non può essere sostituita da un avatar generico. Usa la galleria per rimuoverla.";
    }
  }
  return null;
}
