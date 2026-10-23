// Trigger rules, computed from the data alone: who needs the Owner, what the coordinator owes, quiet agents, waiting agents, stale tabs, queued nudges.
// The same rules are mirrored in tools/page_triggers.py so the coordinator reads exactly what the page shows.
//
// 1. VERIFIED, NOT_APPLICABLE and NOT_STARTED cards never trigger (superseded and cancelled cards are NOT_APPLICABLE).
// 2. needs you: next.actor is YOU, or the card has the flag needs-you. Shown even when the project is on hold.
// 3. paused: the card has the flag paused, or the project index has hold.active. No other card trigger fires for it.
// 4. owes: next.actor is the project's coordinator (rules.coordinator, default OTM; an Oracle in standalone mode) and the card is older than owesAfterMin.
// 5. quiet: state IN_PROGRESS and older than quietAfterMin (ping the agent).
// 6. waiting: state SUBMITTED, next.actor is somebody else, and older than waitingAfterMin.
// 7. stale tab: the project updatedAt is older than staleAfterMin.
// 8. nudge: a card has open Nudge + lines (nudges.json, status open). The coordinator owes them: fold them into the next message to
//    that agent, then record them done. It fires even when the card is paused or the project is on hold, because the Owner asked for it;
//    the coordinator decides when to send. Severity rises at nudgeAfterMin and four times that.
// BLOCKED cards are holds by definition: they only ever show needs you.
const DEFAULTS = { coordinator: 'OTM', staleAfterMin: 120, quietAfterMin: 30, idleAfterMin: 15, owesAfterMin: 15, waitingAfterMin: 15, nudgeAfterMin: 15 };
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
  const isCoord = String(actor).toLowerCase() === String(rules.coordinator).toLowerCase();
  if (['you', 'owner'].includes(String(actor).trim().toLowerCase()) || (c.flags || []).includes('needs-you')) {   // "Owner" means the Owner too
    return [{ k: 'needs-you', t: 'needs you' + (age == null ? '' : ' · ' + fmt(age)), sev: 2 }];
  }
  if (c.state === 'BLOCKED') return [];
  if ((c.flags || []).includes('paused') || hold) return [{ k: 'paused', t: 'paused', sev: 0 }];
  if (age == null) return [];
  if (isCoord && age >= rules.owesAfterMin) {
    return [{ k: 'owes', t: rules.coordinator + ' owes · ' + fmt(age), sev: age >= rules.owesAfterMin * 4 ? 2 : 1 }];
  }
  if (c.state === 'IN_PROGRESS' && age >= rules.quietAfterMin) {
    return [{ k: 'quiet', t: 'quiet ' + fmt(age) + ': ping it', sev: age >= rules.quietAfterMin * 2 ? 2 : 1 }];
  }
  if (c.state === 'SUBMITTED' && actor !== '-' && !isCoord && age >= rules.waitingAfterMin) {
    return [{ k: 'waiting', t: 'waiting for ' + actor + ' · ' + fmt(age), sev: age >= rules.waitingAfterMin * 4 ? 2 : 1 }];
  }
  return [];
}

// openList: the open nudges of one card. Returns a tag, or null when there are none.
export function nudgeTag(openList, rules, now) {
  if (!openList.length) return null;
  const oldest = Math.max.apply(null, openList.map((n) => minutesSince(n.at, now) || 0));
  return { k: 'nudge', t: openList.length + ' nudge' + (openList.length > 1 ? 's' : '') + ' for ' + rules.coordinator + ' · ' + fmt(oldest),
    sev: oldest >= rules.nudgeAfterMin * 4 ? 2 : oldest >= rules.nudgeAfterMin ? 1 : 0 };
}

const SLOT = { 'needs-you': 'needsYou', owes: 'owes', quiet: 'quiet', waiting: 'waiting' };

// cards: the cards.json map (id -> card). nudges: the nudges.json map (id -> nudge), optional.
// Open nudges count only on live cards: a closed card never triggers (rule 1).
export function summary(cardMap, index, now, nudges) {
  const cards = Object.entries(cardMap || {}).map(([id, c]) => Object.assign({ id }, c));
  const rules = rulesOf(index);
  const hold = holdOf(index);
  const out = { needsYou: 0, owes: 0, quiet: 0, waiting: 0, nudges: 0, stale: false, staleFor: null };
  cards.filter((c) => !c.closed).forEach((c) => cardTags(c, rules, now, hold).forEach((t) => { if (SLOT[t.k]) out[SLOT[t.k]] += 1; }));
  const live = new Set(cards.filter((c) => !c.closed && c.state !== 'NOT_APPLICABLE').map((c) => c.id));
  out.nudges = Object.values(nudges || {}).filter((n) => n.status === 'open' && live.has(n.card)).length;
  const m = minutesSince(((index && index.project) || {}).updatedAt, now);
  if (m != null && m > rules.staleAfterMin && !hold) { out.stale = true; out.staleFor = m; }
  return out;
}

export const needsAttention = (s) => s.stale || s.owes > 0 || s.quiet > 0 || s.waiting > 0 || s.nudges > 0;
