export function friendlyError(e: unknown): string {
  const err = e as any;
  const text = String(err?.message ?? '');
  const status = Number(err?.status ?? err?.code);
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(text))
    return 'The AI service is busy right now. Please try again in a minute.';
  if (status === 503 || /overloaded|UNAVAILABLE/i.test(text))
    return 'The AI service is temporarily unavailable. Please try again shortly.';
  if (/PLANNER_TIMEOUT/.test(text)) return 'That took too long. Please try again.';
  return 'Could not build the dashboard. Please try again.';
}