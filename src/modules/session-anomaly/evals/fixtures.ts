import {
  AnomalySignals,
  ClassificationOutput,
} from '../anomaly-classifier.service';
import { AnomalyHistorySummary } from '../types/anomaly-persisted.event';

export type EvalFixture = {
  name: string;
  signals: AnomalySignals;
  history: AnomalyHistorySummary;
  expected: ClassificationOutput['label'];
};

const UA_CHROME_MAC = 'chrome|mac os x';
const UA_SAFARI_IOS = 'safari|iphone';

/**
 * Hand-labeled anomaly events for offline evaluation of the classifier.
 * Labels are the intended ground truth; adjust as the rubric evolves.
 */
export const EVAL_FIXTURES: EvalFixture[] = [
  // --- legitimate: benign but flagged ---
  {
    name: 'passkey new device only',
    signals: {
      flags: ['new_user_agent'],
      score: 10,
      severity: 'warning',
      country: 'AR',
      city: 'Buenos Aires',
      loginKind: 'passkey',
      userAgent: UA_SAFARI_IOS,
    },
    history: {
      total: 30,
      distinctIps: 2,
      distinctCountries: 1,
      distinctUserAgents: 1,
    },
    expected: 'legitimate',
  },
  {
    name: 'passkey travel to known-adjacent country',
    signals: {
      flags: ['new_ip', 'new_country'],
      score: 70,
      severity: 'critical',
      country: 'UY',
      city: 'Montevideo',
      loginKind: 'passkey',
      userAgent: UA_CHROME_MAC,
    },
    history: {
      total: 40,
      distinctIps: 4,
      distinctCountries: 1,
      distinctUserAgents: 1,
    },
    expected: 'legitimate',
  },
  {
    name: 'first login passkey',
    signals: {
      flags: ['first_login'],
      score: 0,
      severity: 'warning',
      country: 'AR',
      city: 'Rosario',
      loginKind: 'passkey',
      userAgent: UA_CHROME_MAC,
    },
    history: {
      total: 0,
      distinctIps: 0,
      distinctCountries: 0,
      distinctUserAgents: 0,
    },
    expected: 'legitimate',
  },
  {
    name: 'new IP same country same device password',
    signals: {
      flags: ['new_ip'],
      score: 30,
      severity: 'warning',
      country: 'AR',
      city: 'Cordoba',
      loginKind: 'password',
      userAgent: UA_CHROME_MAC,
    },
    history: {
      total: 25,
      distinctIps: 6,
      distinctCountries: 1,
      distinctUserAgents: 2,
    },
    expected: 'legitimate',
  },
  {
    name: 'passkey new IP frequent traveller',
    signals: {
      flags: ['new_ip'],
      score: 30,
      severity: 'warning',
      country: 'AR',
      city: 'Mendoza',
      loginKind: 'passkey',
      userAgent: UA_SAFARI_IOS,
    },
    history: {
      total: 50,
      distinctIps: 15,
      distinctCountries: 1,
      distinctUserAgents: 2,
    },
    expected: 'legitimate',
  },
  {
    name: 'new device, established account, low score',
    signals: {
      flags: ['new_user_agent'],
      score: 10,
      severity: 'warning',
      country: 'AR',
      city: 'La Plata',
      loginKind: 'password',
      userAgent: 'firefox|windows',
    },
    history: {
      total: 60,
      distinctIps: 3,
      distinctCountries: 1,
      distinctUserAgents: 3,
    },
    expected: 'legitimate',
  },

  // --- suspicious: unusual, needs verification ---
  {
    name: 'new IP + new device password',
    signals: {
      flags: ['new_ip', 'new_user_agent'],
      score: 40,
      severity: 'warning',
      country: 'AR',
      city: 'Buenos Aires',
      loginKind: 'password',
      userAgent: 'edge|windows',
    },
    history: {
      total: 35,
      distinctIps: 4,
      distinctCountries: 1,
      distinctUserAgents: 1,
    },
    expected: 'suspicious',
  },
  {
    name: 'new country password, plausible travel',
    signals: {
      flags: ['new_country', 'new_ip'],
      score: 70,
      severity: 'critical',
      country: 'ES',
      city: 'Madrid',
      loginKind: 'password',
      userAgent: UA_CHROME_MAC,
    },
    history: {
      total: 45,
      distinctIps: 5,
      distinctCountries: 1,
      distinctUserAgents: 1,
    },
    expected: 'suspicious',
  },
  {
    name: 'new device unusual for stable account',
    signals: {
      flags: ['new_user_agent', 'new_ip'],
      score: 40,
      severity: 'warning',
      country: 'AR',
      city: 'Buenos Aires',
      loginKind: 'password',
      userAgent: 'opera|linux',
    },
    history: {
      total: 80,
      distinctIps: 2,
      distinctCountries: 1,
      distinctUserAgents: 1,
    },
    expected: 'suspicious',
  },
  {
    name: 'new country passkey but far away',
    signals: {
      flags: ['new_ip', 'new_country', 'new_user_agent'],
      score: 80,
      severity: 'critical',
      country: 'JP',
      city: 'Tokyo',
      loginKind: 'passkey',
      userAgent: 'chrome|android',
    },
    history: {
      total: 40,
      distinctIps: 3,
      distinctCountries: 1,
      distinctUserAgents: 1,
    },
    expected: 'suspicious',
  },
  {
    name: 'moderate score, sparse history',
    signals: {
      flags: ['new_ip', 'new_user_agent'],
      score: 40,
      severity: 'warning',
      country: 'BR',
      city: 'Sao Paulo',
      loginKind: 'password',
      userAgent: 'chrome|windows',
    },
    history: {
      total: 5,
      distinctIps: 2,
      distinctCountries: 1,
      distinctUserAgents: 1,
    },
    expected: 'suspicious',
  },
  {
    name: 'new country only, established device reused',
    signals: {
      flags: ['new_country', 'new_ip'],
      score: 70,
      severity: 'critical',
      country: 'CL',
      city: 'Santiago',
      loginKind: 'password',
      userAgent: UA_CHROME_MAC,
    },
    history: {
      total: 20,
      distinctIps: 3,
      distinctCountries: 1,
      distinctUserAgents: 1,
    },
    expected: 'suspicious',
  },

  // --- critical: strong attack signal ---
  {
    name: 'new country + new IP + new device, password',
    signals: {
      flags: ['new_ip', 'new_country', 'new_user_agent'],
      score: 80,
      severity: 'critical',
      country: 'RU',
      city: 'Moscow',
      loginKind: 'password',
      userAgent: 'firefox|windows',
    },
    history: {
      total: 50,
      distinctIps: 3,
      distinctCountries: 1,
      distinctUserAgents: 1,
    },
    expected: 'critical',
  },
  {
    name: 'impossible travel, distant country, password',
    signals: {
      flags: ['new_ip', 'new_country', 'new_user_agent'],
      score: 80,
      severity: 'critical',
      country: 'CN',
      city: 'Beijing',
      loginKind: 'password',
      userAgent: 'chrome|linux',
    },
    history: {
      total: 70,
      distinctIps: 4,
      distinctCountries: 1,
      distinctUserAgents: 2,
    },
    expected: 'critical',
  },
  {
    name: 'new country + new device, very stable prior account',
    signals: {
      flags: ['new_country', 'new_ip', 'new_user_agent'],
      score: 80,
      severity: 'critical',
      country: 'NG',
      city: 'Lagos',
      loginKind: 'password',
      userAgent: 'chrome|android',
    },
    history: {
      total: 120,
      distinctIps: 2,
      distinctCountries: 1,
      distinctUserAgents: 1,
    },
    expected: 'critical',
  },
  {
    name: 'high score, unknown datacenter-like country',
    signals: {
      flags: ['new_ip', 'new_country', 'new_user_agent'],
      score: 80,
      severity: 'critical',
      country: 'NL',
      city: 'Amsterdam',
      loginKind: 'password',
      userAgent: 'unknown|unknown',
    },
    history: {
      total: 90,
      distinctIps: 3,
      distinctCountries: 1,
      distinctUserAgents: 2,
    },
    expected: 'critical',
  },
  {
    name: 'new device + new country, password, tiny history',
    signals: {
      flags: ['new_country', 'new_ip', 'new_user_agent'],
      score: 80,
      severity: 'critical',
      country: 'IR',
      city: 'Tehran',
      loginKind: 'password',
      userAgent: 'chrome|windows',
    },
    history: {
      total: 15,
      distinctIps: 1,
      distinctCountries: 1,
      distinctUserAgents: 1,
    },
    expected: 'critical',
  },

  // --- more legitimate to balance classes ---
  {
    name: 'passkey new IP daily user',
    signals: {
      flags: ['new_ip'],
      score: 30,
      severity: 'warning',
      country: 'AR',
      city: 'Buenos Aires',
      loginKind: 'passkey',
      userAgent: UA_SAFARI_IOS,
    },
    history: {
      total: 200,
      distinctIps: 40,
      distinctCountries: 1,
      distinctUserAgents: 2,
    },
    expected: 'legitimate',
  },
  {
    name: 'known second device passkey',
    signals: {
      flags: ['new_user_agent'],
      score: 10,
      severity: 'warning',
      country: 'AR',
      city: 'Buenos Aires',
      loginKind: 'passkey',
      userAgent: UA_CHROME_MAC,
    },
    history: {
      total: 100,
      distinctIps: 5,
      distinctCountries: 1,
      distinctUserAgents: 2,
    },
    expected: 'legitimate',
  },
  {
    name: 'first login password from home country',
    signals: {
      flags: ['first_login'],
      score: 0,
      severity: 'warning',
      country: 'AR',
      city: 'Buenos Aires',
      loginKind: 'password',
      userAgent: 'chrome|windows',
    },
    history: {
      total: 0,
      distinctIps: 0,
      distinctCountries: 0,
      distinctUserAgents: 0,
    },
    expected: 'legitimate',
  },

  // --- more suspicious ---
  {
    name: 'new IP + new device, moderate, no country change',
    signals: {
      flags: ['new_ip', 'new_user_agent'],
      score: 40,
      severity: 'warning',
      country: 'AR',
      city: 'Cordoba',
      loginKind: 'password',
      userAgent: 'safari|mac os x',
    },
    history: {
      total: 30,
      distinctIps: 3,
      distinctCountries: 1,
      distinctUserAgents: 1,
    },
    expected: 'suspicious',
  },
  {
    name: 'new country passkey, sparse history',
    signals: {
      flags: ['new_ip', 'new_country'],
      score: 70,
      severity: 'critical',
      country: 'US',
      city: 'New York',
      loginKind: 'passkey',
      userAgent: UA_CHROME_MAC,
    },
    history: {
      total: 6,
      distinctIps: 2,
      distinctCountries: 1,
      distinctUserAgents: 1,
    },
    expected: 'suspicious',
  },

  // --- more critical ---
  {
    name: 'new country + new device password, heavy prior single-country use',
    signals: {
      flags: ['new_country', 'new_ip', 'new_user_agent'],
      score: 80,
      severity: 'critical',
      country: 'RO',
      city: 'Bucharest',
      loginKind: 'password',
      userAgent: 'firefox|linux',
    },
    history: {
      total: 150,
      distinctIps: 3,
      distinctCountries: 1,
      distinctUserAgents: 1,
    },
    expected: 'critical',
  },
  {
    name: 'high score, unknown device, distant country, password',
    signals: {
      flags: ['new_ip', 'new_country', 'new_user_agent'],
      score: 80,
      severity: 'critical',
      country: 'IN',
      city: 'Mumbai',
      loginKind: 'password',
      userAgent: 'unknown|android',
    },
    history: {
      total: 110,
      distinctIps: 4,
      distinctCountries: 1,
      distinctUserAgents: 2,
    },
    expected: 'critical',
  },
];
