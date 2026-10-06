const MS_PER_DAY = 86_400_000;

export function previousDay(value: string) {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) throw new Error("Fecha de vigencia no válida.");
  return new Date(timestamp - MS_PER_DAY).toISOString().slice(0, 10);
}

export function resolveRuleEnd(requestedEnd: string | null, nextStart: string | null) {
  if (!nextStart) return requestedEnd;
  if (requestedEnd && requestedEnd >= nextStart) throw new Error("La fecha final se solapa con la siguiente regla.");
  return requestedEnd ?? previousDay(nextStart);
}
