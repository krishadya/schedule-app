export function localDateTimeToIso(value: string) {
  const parsed = new Date(value);

  if (!value || Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export function isExplicitTimestamp(value: string) {
  return /(?:z|[+-]\d{2}:\d{2})$/i.test(value);
}
