export const ANOMALY_PERSISTED_EVENT = 'anomaly.persisted';

/**
 * Compact, PII-light summary of the user's recent login history. Distinct
 * counts only — never raw history rows. Assembled by the rule engine so the
 * classifier never has to touch the sessions table.
 */
export type AnomalyHistorySummary = {
  total: number;
  distinctIps: number;
  distinctCountries: number;
  distinctUserAgents: number;
};

export type AnomalyPersistedEvent = {
  eventId: string;
  history: AnomalyHistorySummary;
};
