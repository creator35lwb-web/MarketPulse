// Public links: the dashboard, the channel, the feedback form and the share text, in one place.
// Prepended by the workflow builder to the daily and weekly Telegram composers; the dashboard
// (docs/app.js) keeps the same values, and tests/share-feedback.test.mjs holds the two equal.
// A fork changes this file and the LINKS block in docs/app.js.
const MP_LINKS = (() => {
  const DASHBOARD = 'https://creator35lwb-web.github.io/MarketPulse/';
  const REPOSITORY = 'https://github.com/creator35lwb-web/MarketPulse';
  const CHANNEL = 'https://t.me/n8nMarketPulse';
  // The feedback form is a Google Form Alton owns: anonymous, no sign-in (docs/feedback-form.md).
  // Both values come from its pre-filled link; the field is question 5, "Brief details". A fork
  // that empties them shows no feedback link.
  const FEEDBACK_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSfxD7YzmLxOOCP580jiIK81aNF_Ky1S4QNpr6JdO0c9JT5cJQ/viewform';
  const FEEDBACK_DETAILS_FIELD = 'entry.857131096';
  const PITCH = 'MarketPulse: a free daily US and China market brief for value investors. ' +
    'A long-term reading on fixed rules, and an AI short-term read that cites its data.';

  const EDITION_HASH = {US: '#us', CN: '#cn'};
  const dashboard = edition => DASHBOARD + (EDITION_HASH[edition] || '');

  // The form opens with the brief's details filled in, so a "number looks wrong" report can be
  // checked against the exact brief the reader saw. Returns '' while no form is set.
  function feedback(details) {
    if (!FEEDBACK_FORM) return '';
    if (!FEEDBACK_DETAILS_FIELD || !details) return FEEDBACK_FORM;
    return FEEDBACK_FORM + '?usp=pp_url&' + FEEDBACK_DETAILS_FIELD + '=' + encodeURIComponent(details);
  }

  const telegramShare = (url, text) => 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text);

  // URLs for the buttons under a post. Each is an absolute https URL in every case, because
  // Telegram rejects the whole post when a button URL is invalid: without a form, the feedback
  // button opens the dashboard.
  function forPost(edition, date) {
    const details = ['telegram', edition, date].filter(Boolean).join(' · ');
    return {
      dashboard: dashboard(edition),
      feedback: feedback(details) || dashboard(edition),
      share: telegramShare(CHANNEL, PITCH),
    };
  }

  return {DASHBOARD, REPOSITORY, CHANNEL, FEEDBACK_FORM, FEEDBACK_DETAILS_FIELD, PITCH, dashboard, feedback, telegramShare, forPost};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MP_LINKS;
