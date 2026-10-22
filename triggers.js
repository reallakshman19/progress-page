// Trigger rules, computed from the data alone: who needs the Owner, what OTM owes, quiet agents, waiting agents, stale tabs.
// The same rules are mirrored in tools/page_triggers.py so the coordinator reads exactly what the page shows.
//
// 1. VERIFIED, NOT_APPLICABLE and NOT_STARTED cards never trigger.
// 2. needs you: next.actor is YOU, or the card has the flag needs-you. Shown even when the project is on hold.
// 3. paused: the card has the flag paused, or the project index has hold.active. No other trigger fires for it.
// 4. OTM owes: next.actor is OTM and the card is older than owesAfterMin.
// 5. quiet: state IN_PROGRESS and older than quietAfterMin (ping the agent).
// 6. waiting: state SUBMITTED, next.actor is somebody else, and older than waitingAfterMin.
// 7. stale tab: the project updatedAt is older than staleAfterMin.
// BLOCKED cards are holds by definition: they only ever show needs you.
const DEFAULTS = { staleAfterMin: 120, quietAfterMin: 30, idleAfterMin: 15, owesAfterMin: 15, waitingAfterMin: 15 };
const SKIP = new Set(['VERIFIED', 'NOT_APPLICABLE', 'NOT_STARTED']);

export const rulesOf = (index) => Object.assign({}, DEFAULTS, (index && index.project) || {}, (index && index.rules) || {});
export const holdOf = (index) => !!(index && index.hold && index.hold.active);

export function minutesSince(iso, now) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.floor(((now || Date.now()) - t) / 60000) : null;
}

export function fmt(min) {
  if (min < 60) return min + 'm';
  const h = Math.floor(min / 60);
  return h < 48 ? h + 'h ' + (min % 60) + 'm' : Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
}

// Returns at most one tag per card. sev 2 = far past the limit (4x; quiet: 2x), sev 1 = past it, sev 0 = informational.
export function cardTags(c, rules, now, hold) {
  if (SKIP.has(c.state)) return [];
  const age = minutesSince(c.updatedAt, now);
  const actor = (c.next && c.next.actor) || '-';
  if (actor === 'YOU' || (c.flags || []).includes('needs-you')) {
    return [{ k: 'needs-you', t: 'needs you' + (age == null ? '' : ' · ' + fmt(age)), sev: 2 }];
  }
  if ((c.flags || []).includes('paused') || hold) return [{ k: 'paused', t: 'paused', sev: 0 }];
  if (age == null) return [];
  if (actor === 'OTM' && age >= rules.owesAfterMin) {
    return [{ k: 'owes', t: 'OTM owes · ' + fmt(age), sev: age >= rules.owesAfterMin * 4 ? 2 : 1 }];
  }
  if (c.state === 'IN_PROGRESS' && age >= rules.quietAfterMin) {
    return [{ k: 'quiet', t: 'quiet ' + fmt(age) + ': ping it', sev: age >= rules.quietAfterMin * 2 ? 2 : 1 }];
  }
  if (c.state === 'SUBMITTED' && actor !== '-' && actor !== 'OTM' && age >= rules.waitingAfterMin) {
    return [{ k: 'waiting', t: 'waiting for ' + actor + ' · ' + fmt(age), sev: age >= rules.waitingAfterMin * 4 ? 2 : 1 }];
  }
  return [];
}

const SLOT = { 'needs-you': 'needsYou', owes: 'owes', quiet: 'quiet', waiting: 'waiting' };

export function summary(cards, index, now) {
  const rules = rulesOf(index);
  const hold = holdOf(index);
  const out = { needsYou: 0, owes: 0, quiet: 0, waiting: 0, stale: false, staleFor: null };
  cards.forEach((c) => cardTags(c, rules, now, hold).forEach((t) => { if (SLOT[t.k]) out[SLOT[t.k]] += 1; }));
  const m = minutesSince(((index && index.project) || {}).updatedAt, now);
  if (m != null && m > rules.staleAfterMin && !hold) { out.stale = true; out.staleFor = m; }
  return out;
}

export const needsAttention = (s) => s.stale || s.owes > 0 || s.quiet > 0 || s.waiting > 0;
