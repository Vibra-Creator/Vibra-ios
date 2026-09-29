const DEFAULT_BLOCKED_TERMS = [
  "cazzo", "minchia", "stronzo", "stronza", "vaffanculo", "puttana", "troia",
  "bastardo", "bastarda", "coglione", "cogliona", "merda", "fanculo", "porco",
  "negro", "negra", "frocio", "finocchio", "ritardato", "ritardata",
  "mongoloide", "handicappato", "deficiente", "idiota",
  "ti ammazzo", "ti uccido", "crepa", "muori", "suicidati",
  "fuck", "shit", "bitch", "asshole", "nigger", "faggot", "retard",
  "dick pic", "nudes", "sesso orale",
];

const USER_TEXT_FIELDS = new Set([
  "bio",
  "body",
  "caption",
  "comment",
  "content",
  "description",
  "interests",
  "message",
  "name",
  "question",
  "reply",
  "text",
  "title",
]);

export function hasUgcTextPayload(value: unknown, fieldName?: string): boolean {
  if (fieldName && USER_TEXT_FIELDS.has(fieldName.toLowerCase())) {
    return typeof value === "string" || Array.isArray(value) || Boolean(value && typeof value === "object");
  }
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    return value.some((item) => hasUgcTextPayload(item, fieldName));
  }

  return Object.entries(value).some(([key, item]) => {
    return hasUgcTextPayload(item, key);
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function filterOffensiveContent(text: string, additionalTerms: string[] = []): string {
  let filtered = text;
  const terms = new Set([...DEFAULT_BLOCKED_TERMS, ...additionalTerms]);

  for (const rawTerm of Array.from(terms)) {
    const term = rawTerm.trim();
    if (!term) continue;
    const pattern = escapeRegExp(term).replace(/\s+/g, "\\s+");
    const expression = new RegExp(
      `(^|[^\\p{L}\\p{N}_])(${pattern})(?=$|[^\\p{L}\\p{N}_])`,
      "giu",
    );
    filtered = filtered.replace(expression, (_match, prefix: string, matchedTerm: string) => (
      `${prefix}${matchedTerm.replace(/[^\s]/g, "*")}`
    ));
  }

  return filtered;
}

export function filterUgcTextPayload(value: unknown, additionalTerms: string[] = [], fieldName?: string): unknown {
  if (typeof value === "string") {
    return fieldName && USER_TEXT_FIELDS.has(fieldName.toLowerCase())
      ? filterOffensiveContent(value, additionalTerms)
      : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => filterUgcTextPayload(item, additionalTerms, fieldName));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        filterUgcTextPayload(item, additionalTerms, key),
      ]),
    );
  }

  return value;
}