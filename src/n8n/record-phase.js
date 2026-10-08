// The phase of the public record (W25). MarketPulse restarted its track record as a beta when the
// launch bundle went live. Calls and grades written by this code carry the phase, and readers see
// only the current phase's record. The record published before the beta is archived unchanged in
// docs/archive/; older entries stay in staticData until the 30-entry windows roll them out.
// Prepended by the workflow builder to every node that reads or writes the record.
const MP_PHASE = (() => {
  const CURRENT = 'beta';
  const LABEL = 'Beta';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const current = entry => !!entry && entry.phase === CURRENT;

  // '2026-10-12' becomes 'Oct 12, 2026', the US style the posts already use; anything else becomes ''.
  function dateLabel(isoDate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ''));
    const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
    return month ? month + ' ' + Number(m[3]) + ', ' + m[1] : '';
  }

  return {CURRENT, LABEL, current, dateLabel};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MP_PHASE;
