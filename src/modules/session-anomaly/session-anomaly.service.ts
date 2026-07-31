import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Not, Repository } from 'typeorm';
import * as geoip from 'geoip-lite';
import { Session } from '../sessions/entities/session.entity';
import {
  AnomalySeverity,
  SessionAnomalyEvent,
} from './entities/session-anomaly-event.entity';

const HISTORY_WINDOW_DAYS = 90;
const WARNING_THRESHOLD = 40;
const CRITICAL_THRESHOLD = 70;

type AnalyzeInput = {
  userId: string;
  tenantId: string | null;
  sessionId: string | null;
  ip: string | null;
  userAgent: string | null;
  loginKind: 'password' | 'passkey';
};

export type AnomalyResult = {
  score: number;
  flags: string[];
  severity: AnomalySeverity;
  country: string | null;
  city: string | null;
};

@Injectable()
export class SessionAnomalyService {
  private readonly logger = new Logger(SessionAnomalyService.name);

  constructor(
    @InjectRepository(SessionAnomalyEvent)
    private readonly events: Repository<SessionAnomalyEvent>,
    @InjectRepository(Session)
    private readonly sessions: Repository<Session>,
  ) {}

  async analyze(input: AnalyzeInput): Promise<AnomalyResult> {
    const normalizedIp = normalizeIp(input.ip);
    const geo = normalizedIp ? geoip.lookup(normalizedIp) : null;
    const country = geo?.country ?? null;
    const city = geo?.city ?? null;
    const uaFingerprint = fingerprintUserAgent(input.userAgent);

    const flags: string[] = [];
    let score = 0;

    // Load recent history (successful sessions from the last N days).
    // The session we're analyzing has already been persisted by the caller
    // (auth.service / passkeys.service create the session first, then call us
    // with its id). Exclude it from history so we compare the current attempt
    // against previous attempts, not against itself.
    const since = new Date(Date.now() - HISTORY_WINDOW_DAYS * 86400 * 1000);
    const history = await this.sessions.find({
      where: {
        userId: input.userId,
        createdAt: MoreThan(since),
        ...(input.sessionId ? { id: Not(input.sessionId) } : {}),
      },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    if (history.length === 0) {
      // First-ever login for this user in the window; can't establish
      // a baseline, so we mark it info-level and move on.
      flags.push('first_login');
    } else {
      const seenIps = new Set(
        history.map((s) => normalizeIp(s.ip)).filter((v): v is string => !!v),
      );
      const seenCountries = new Set<string>();
      const seenUaFingerprints = new Set<string>();
      for (const s of history) {
        const ipNorm = normalizeIp(s.ip);
        if (ipNorm) {
          const g = geoip.lookup(ipNorm);
          if (g?.country) seenCountries.add(g.country);
        }
        const fp = fingerprintUserAgent(s.userAgent);
        if (fp) seenUaFingerprints.add(fp);
      }

      if (normalizedIp && !seenIps.has(normalizedIp)) {
        flags.push('new_ip');
        score += 30;
      }

      if (country && !seenCountries.has(country)) {
        flags.push('new_country');
        score += 40;
      }

      if (uaFingerprint && !seenUaFingerprints.has(uaFingerprint)) {
        flags.push('new_user_agent');
        score += 10;
      }
    }

    const severity: AnomalySeverity =
      score >= CRITICAL_THRESHOLD
        ? 'critical'
        : score >= WARNING_THRESHOLD
          ? 'warning'
          : 'info';

    if (severity !== 'info') {
      const row = this.events.create({
        userId: input.userId,
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        ip: normalizedIp,
        country,
        city,
        userAgent: input.userAgent,
        score,
        flags,
        severity,
        loginKind: input.loginKind,
      });
      await this.events.save(row);

      this.logger.warn(
        `Session anomaly [${severity}] user=${input.userId} score=${score} flags=${flags.join(',')} ip=${normalizedIp} country=${country}`,
      );
    }

    return { score, flags, severity, country, city };
  }

  async listForUser(userId: string, limit = 50) {
    return this.events.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}

function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.split(',')[0]?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('::ffff:')) return trimmed.slice(7);
  return trimmed;
}

function fingerprintUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  // Coarse fingerprint: browser family + OS family, ignoring minor versions.
  const browser =
    ua.match(/(Chrome|Firefox|Safari|Edge|Opera|CriOS|FxiOS)/i)?.[1] ??
    'unknown';
  const os =
    ua.match(/(Windows|Mac OS X|Macintosh|Linux|Android|iPhone|iPad|iOS)/i)?.[1] ??
    'unknown';
  return `${browser.toLowerCase()}|${os.toLowerCase()}`;
}
