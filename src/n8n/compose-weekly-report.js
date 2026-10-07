// ===== WEEKLY DEEP MVP (2026-07-22) =====
// Deterministic weekly wrap synthesized ONLY from the verdict ledger in staticData.
// No LLM call, no market fetch: every line below restates an already-verified,
// dated record. Fires Sunday 08:00 MYT: both markets have been closed since
// Saturday morning MYT, so the trading week is complete. Window = the 7 days
// ending Saturday, partitioning the calendar into clean Sun-Sat weeks.
const sd = $getWorkflowStaticData('global');
const ledger = sd.mpLedger || {};
const track = sd.mpTrackRecord || {};

// MYT is fixed UTC+8 (no DST) - shift the clock, then read the ISO date.
const MS_DAY = 24 * 3600 * 1000;
const mytNow = new Date(Date.now() + 8 * 3600 * 1000);
const iso = function (dt) { return dt.toISOString().slice(0, 10); };
// Window: the 7 days ENDING YESTERDAY (the completed week, Mon..Sun when fired Monday).
const endISO = iso(new Date(mytNow.getTime() - 1 * MS_DAY));
const startISO = iso(new Date(mytNow.getTime() - 7 * MS_DAY));

const esc = function (s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};
const sentIcon = function (s) {
  const t = String(s || '').toLowerCase();
  if (t.indexOf('bull') !== -1) return '🟢';
  if (t.indexOf('bear') !== -1) return '🔴';
  return '⚪';
};
const dayName = function (isoDate) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(isoDate + 'T00:00:00Z').getUTCDay()];
};
const fmtRange = function (a, b) {
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const da = new Date(a + 'T00:00:00Z'), db = new Date(b + 'T00:00:00Z');
  const left = M[da.getUTCMonth()] + ' ' + da.getUTCDate();
  const right = (da.getUTCMonth() === db.getUTCMonth() ? '' : M[db.getUTCMonth()] + ' ') + db.getUTCDate() + ', ' + db.getUTCFullYear();
  return left + '–' + right;
};

const inWindow = function (d) { return d && d >= startISO && d <= endISO; };

const sections = [];
const editions = [
  { key: 'US', flag: '🇺🇸', index: 'S&amp;P 500' },
  { key: 'CN', flag: '🇨🇳', index: 'CSI 300' },
];
for (const ed of editions) {
  const calls = (ledger[ed.key] || []).filter(function (e) { return inWindow(e.date); });
  const scored = (track[ed.key] || []).filter(function (t) { return inWindow(t.scoredDate); });
  const allTime = track[ed.key] || [];
  // Flats are excluded from both numerator and denominator - a day the market did not
  // move is not a missed call. Counting them as misses would understate the record as
  // badly as counting them as hits would flatter it.
  const allDecided = allTime.filter(function (t) { return t.result === 'hit' || t.result === 'miss'; });
  const allHits = allDecided.filter(function (t) { return t.result === 'hit'; }).length;
  const weekDecided = scored.filter(function (t) { return t.result === 'hit' || t.result === 'miss'; });
  const weekHits = weekDecided.filter(function (t) { return t.result === 'hit'; }).length;

  const lines = [];
  lines.push(ed.flag + ' <b>' + ed.key + ' edition</b>');
  if (calls.length === 0 && scored.length === 0) {
    lines.push('No digests were published this week.');
    sections.push(lines.join('\n'));
    continue;
  }
  if (calls.length > 0) {
    lines.push('<u>Calls made (' + calls.length + '):</u>');
    for (const c of calls) {
      const sTxt = c.sentiment ? esc(c.sentiment) : '<i>no verdict recorded</i>';
      lines.push(sentIcon(c.sentiment) + ' ' + dayName(c.date) + ' ' + c.date.slice(5) + ' — ' + sTxt + (c.model ? ' <i>(' + esc(c.model) + ')</i>' : ''));
    }
  }
  if (scored.length > 0) {
    lines.push('<u>Calls scored against ' + ed.index + ':</u>');
    for (const t of scored) {
      const mark = t.result === 'hit' ? '✅ hit' : t.result === 'flat' ? '⚪ too flat to judge' : '❌ miss';
      const gap = t.gapDays && t.gapDays > 1 ? ' (' + t.gapDays + '-day gap)' : '';
      lines.push(mark + ' — ' + dayName(t.priorDate) + ' ' + t.priorDate.slice(5) + ' called ' + esc(t.priorSentiment) + ', market moved ' + esc(t.actualChange) + gap);
    }
    // Denominators are the DECIDED counts, matching the numerators above. Using the raw
  // totals here would silently count every flat day as a miss.
  var flatWeek = scored.length - weekDecided.length;
  lines.push('Week: <b>' + weekHits + '/' + weekDecided.length + '</b> · All-time: <b>' + allHits + '/' + allDecided.length + '</b>'
    + (flatWeek ? ' · <i>' + flatWeek + ' day' + (flatWeek === 1 ? '' : 's') + ' too flat to judge</i>' : ''));
  // W4: the base rate on the same judged days, so a call that rarely changes is not flattered.
  const fellOn = function (list) { return list.filter(function (t) { return Number.parseFloat(t.actualChange) < 0; }).length; };
  if (allDecided.length) {
    const allTimeFell = fellOn(allDecided) + ' of ' + allDecided.length;
    lines.push('<i>For comparison, the market fell on ' + (weekDecided.length
      ? fellOn(weekDecided) + ' of ' + weekDecided.length + ' judged days this week and ' + allTimeFell + ' all-time.'
      : allTimeFell + ' judged days all-time.') + '</i>');
  }
  } else {
    lines.push('No calls came due for scoring this week.');
  }
  sections.push(lines.join('\n'));
}

// Long-term reading (rules ltr.v1): restate the confirmed level and whether it changed this week.
let longTerm = '';
try {
  const lt = sd.mpLongTerm && sd.mpLongTerm.US;
  if (lt && lt.confirmed) {
    const label = MP_LTR.rangeLabel(lt.confirmed.lo, lt.confirmed.hi);
    const moves = (Array.isArray(lt.history) ? lt.history : []).filter(function (h) { return inWindow(h.date); });
    longTerm = '🧭 <b>Long-term reading (US):</b> ' + esc(label) + ' · margin of safety ' + esc(MP_LTR.marginFor(lt.confirmed.hi).toLowerCase()) +
      (moves.length ? ' · <i>changed this week</i>' : ' · <i>unchanged this week (since ' + esc(lt.confirmed.since) + ')</i>');
  }
} catch (_) { longTerm = ''; }

const message = [
  '📅 <b>MarketPulse Weekly — ' + fmtRange(startISO, endISO) + '</b>',
  '<i>Every line restates a dated, verified record from the public ledger — including the misses. Nothing is recalled from memory.</i>',
  ...(longTerm ? [longTerm] : []),
  sections.join('\n\n'),
  '📖 Daily digests, sources and the full track record:\n' + MP_LINKS.DASHBOARD,
].join('\n\n');

// URLs for the Dashboard, Feedback and Share buttons under the post.
return [{ json: { message: message, links: MP_LINKS.forPost('weekly', endISO) } }];
