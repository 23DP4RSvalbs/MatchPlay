import { useEffect, useState } from 'react';
import { elapsed, type MatchSummary } from '@matchplay/shared/game';
import { clockText } from '../lib/format';

export function Clock({
  match,
  countdown = false,
  compact = false,
  offset = 0,
}: {
  match: MatchSummary;
  countdown?: boolean;
  compact?: boolean;
  offset?: number;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = countdown
    ? Date.parse(match.startsAt) - now - offset
    : match.durationMinutes * 60_000 - elapsed(match, now + offset);
  return (
    <span
      className={`clock ${compact ? 'compact' : ''}`}
      aria-label={countdown ? 'Time until game' : 'Game clock'}
    >
      {clockText(remaining, countdown)}
    </span>
  );
}
