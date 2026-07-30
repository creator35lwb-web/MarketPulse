(function () {
  'use strict';

  var app = document.getElementById('app');
  var tpl = document.getElementById('tpl-report');
  var toggle = document.querySelector('.edition-toggle');
  var currentEdition = 'US';

  function fmtDirection(dir) {
    return dir === 'supports_bullish' ? 'supports_bullish'
         : dir === 'supports_bearish' ? 'supports_bearish'
         : 'neutral';
  }

  function changeClass(str) {
    if (typeof str !== 'string') return '';
    if (str.trim().charAt(0) === '+') return 'up';
    if (str.trim().charAt(0) === '-') return 'down';
    return '';
  }

  function sentimentClass(s) {
    var t = String(s || '').toLowerCase();
    if (t.indexOf('bullish') !== -1) return 'bullish';
    if (t.indexOf('bearish') !== -1) return 'bearish';
    return 'neutral';
  }

  function fmtHistoryDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function ledgerRow(label, value, opts) {
    opts = opts || {};
    var row = el('div', 'ledger-row' + (opts.dashboard ? ' dashboard-row' : ''));
    if (opts.factKey) row.dataset.factkey = opts.factKey;

    if (opts.dashboard) {
      var stack = el('div', 'stack');
      var lbl = el('span', 'label', (opts.emoji ? opts.emoji + ' ' : '') + label);
      var status = el('span', 'status', opts.status || '');
      stack.appendChild(lbl); stack.appendChild(status);
      row.appendChild(stack);
      var val = el('div', 'value', value);
      row.appendChild(val);
    } else {
      row.appendChild(el('div', 'label', label));
      if (opts.status !== undefined) row.appendChild(el('div', 'status', opts.status));
      var v = el('div', 'value ' + (opts.change ? 'change ' + changeClass(opts.change) : ''));
      v.textContent = value + (opts.change ? ' (' + opts.change + ')' : '');
      row.appendChild(v);
    }
    return row;
  }

  function render(data) {
    app.innerHTML = '';
    var node = tpl.content.cloneNode(true);

    node.querySelector('.date').textContent = data.dateLabel || '';
    node.querySelector('.edition-name').textContent = data.edition === 'CN' ? 'China Market' : 'US Market';
    var sentimentWord = node.querySelector('.sentiment-word');
    sentimentWord.textContent = (data.analysis && data.analysis.sentiment) || 'Unavailable';

    // data quality banner - built via DOM methods, not innerHTML, so no dynamic
    // value (even from our own trusted pipeline) is ever interpreted as markup
    var banner = node.querySelector('.flag-banner');
    var suspect = data.health && data.health.suspect;
    function setBanner(boldText, restText) {
      banner.textContent = '';
      banner.appendChild(el('b', null, boldText));
      banner.appendChild(document.createTextNode(' ' + restText));
      banner.hidden = false;
    }
    if (data.health && data.health.status === 'OUTAGE') {
      setBanner('Data outage.', 'Most live sources failed to load this run. Values below may be missing.');
    } else if (data.health && data.health.status === 'DEGRADED') {
      setBanner('Partial data.', 'Some sources were unavailable this run.');
    } else if (suspect && suspect.length) {
      var suspectText = suspect.map(function (s) { return s.field + ' (' + s.value + ')'; }).join(', ') + '.';
      setBanner('Data quality flag.', 'Unusual reading(s), verify before relying on: ' + suspectText);
    }

    // dashboard (US-only concept - hide the whole section when there's nothing to show)
    var dashKeys = data.dashboard ? Object.keys(data.dashboard) : [];
    if (dashKeys.length) {
      var dashLedger = node.querySelector('.dashboard-ledger');
      dashKeys.forEach(function (key) {
        var d = data.dashboard[key];
        dashLedger.appendChild(ledgerRow(d.title, d.value, { dashboard: true, status: d.status, emoji: d.emoji, factKey: key }));
      });
    } else {
      node.querySelector('.dashboard-section').hidden = true;
    }

    // fear & greed (US-only - hide the whole section when absent)
    if (data.fearGreed) {
      var score = Math.max(0, Math.min(100, Number(data.fearGreed.score) || 0));
      node.querySelector('.gauge-dot').style.left = score + '%';
      node.querySelector('.gauge-readout .score').textContent = data.fearGreed.score + '/100';
      node.querySelector('.gauge-readout .label').textContent =
        data.fearGreed.classification + ' · ' + data.fearGreed.change1d + ' (1d)';
    } else {
      node.querySelector('.feargreed-section').hidden = true;
    }

    // screener
    var screenerLedger = node.querySelector('.screener-ledger');
    (data.screener || []).forEach(function (s) {
      screenerLedger.appendChild(ledgerRow(s.label, s.value, { change: s.change, factKey: s.factKey }));
    });

    // economic
    var econLedger = node.querySelector('.economic-ledger');
    (data.economic || []).forEach(function (e2) {
      econLedger.appendChild(ledgerRow(e2.label + (e2.period ? ' (' + e2.period + ')' : ''), e2.value, { factKey: e2.factKey }));
    });

    // watchlist - rendered as the same preformatted text the pipeline already
    // produces for Telegram, not re-parsed into structured cards (parsing a
    // formatted string back into data is exactly the kind of thing that
    // breaks silently the moment the format shifts slightly)
    var watchBlock = node.querySelector('.watchlist-block');
    var watchText = (data.watchlist || '').trim();
    if (watchText) {
      watchBlock.textContent = watchText;
    } else {
      node.querySelector('.watchlist-section').hidden = true;
    }

    // track record
    if (data.trackRecord) {
      node.querySelector('.trackrecord .accuracy').textContent = data.trackRecord.accuracy || 'Building history';
      node.querySelector('.trackrecord .last').textContent = data.trackRecord.last || '';
    }

    // sentiment history - a day-by-day timeline built from the same ledger the
    // track record above already summarizes as a single number. Needs at least
    // a couple of days before a timeline means anything.
    var history = data.history || [];
    if (history.length < 2) {
      node.querySelector('.history-empty').hidden = false;
      node.querySelector('.history-legend').hidden = true;
    } else {
      var historyStrip = node.querySelector('.history-strip');
      history.forEach(function (h) {
        var cell = el('div', 'history-cell ' + sentimentClass(h.sentiment));
        cell.tabIndex = 0;
        cell.setAttribute('role', 'listitem');
        cell.title = fmtHistoryDate(h.date) + ': ' + (h.sentiment || 'n/a');
        cell.dataset.date = h.date || '';
        cell.dataset.sentiment = h.sentiment || 'n/a';
        cell.dataset.result = h.result || '';
        cell.dataset.actualChange = h.actualChange || '';
        cell.appendChild(el('div', 'history-dot' + (h.result ? ' ' + h.result : '')));
        historyStrip.appendChild(cell);
      });
    }

    // claims + interpretation + wisdom (the signature interaction lives here)
    var claimsEl = node.querySelector('.claims');
    var claims = (data.analysis && data.analysis.claims) || [];
    claims.forEach(function (c) {
      var claim = el('div', 'claim');
      claim.tabIndex = 0;
      claim.setAttribute('role', 'button');
      claim.dataset.basedon = JSON.stringify(c.basedOn || []);
      claim.appendChild(el('div', 'dir ' + fmtDirection(c.direction)));
      var body = el('div');
      body.appendChild(el('div', 'text', c.text));
      var tag = el('div', 'evidence-tag', (c.basedOn || []).join(', '));
      body.appendChild(tag);
      claim.appendChild(body);
      claimsEl.appendChild(claim);
    });

    node.querySelector('.interpretation').textContent = (data.analysis && data.analysis.interpretation) || '';
    var wisdomEl = node.querySelector('.wisdom');
    if (data.analysis && data.analysis.wisdom) {
      wisdomEl.textContent = '“' + data.analysis.wisdom + '”';
    } else {
      wisdomEl.hidden = true;
    }

    // today's headlines — each links to its real source when the pipeline captured one
    var news = data.news || [];
    if (news.length) {
      var newsList = node.querySelector('.news-list');
      news.forEach(function (n) {
        var li = el('li', 'news-item');
        if (n.url) {
          var a = document.createElement('a');
          a.href = n.url;
          a.textContent = n.title;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          li.appendChild(a);
        } else {
          li.textContent = n.title;
        }
        newsList.appendChild(li);
      });
    } else {
      node.querySelector('.news-section').hidden = true;
    }

    // verified strip
    var vCount = (data.analysis && data.analysis.claims && data.analysis.claims.length) || 0;
    node.querySelector('.verified-strip').textContent =
      vCount > 0
        ? vCount + ' claim' + (vCount === 1 ? '' : 's') + ' attributed to source data. All numbers injected from sources, never AI-generated.'
        : 'AI analysis withheld today — its reasoning failed attribution verification. The data above stands on its own.';

    node.querySelector('.sources').textContent = 'Sources: ' + (data.sources || []).join(', ');

    app.appendChild(node);
    wireInteraction();
  }

  function wireInteraction() {
    var ledgerRows = app.querySelectorAll('.ledger-row[data-factkey]');
    var byKey = {};
    ledgerRows.forEach(function (r) { byKey[r.dataset.factkey] = byKey[r.dataset.factkey] || []; byKey[r.dataset.factkey].push(r); });

    function clearActive() {
      app.querySelectorAll('.is-cited').forEach(function (r) { r.classList.remove('is-cited'); });
      app.querySelectorAll('.claim.is-active').forEach(function (c) { c.classList.remove('is-active'); });
    }

    function activateClaim(claim) {
      var wasActive = claim.classList.contains('is-active');
      clearActive();
      if (wasActive) return; // toggle off
      claim.classList.add('is-active');
      var keys = JSON.parse(claim.dataset.basedon || '[]');
      var firstRow = null;
      keys.forEach(function (k) {
        (byKey[k] || []).forEach(function (row) {
          row.classList.add('is-cited');
          if (!firstRow) firstRow = row;
        });
      });
      if (firstRow) firstRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    app.querySelectorAll('.claim').forEach(function (claim) {
      claim.addEventListener('click', function () { activateClaim(claim); });
      claim.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); activateClaim(claim); }
      });
    });

    var sentimentWord = app.querySelector('.sentiment-word');
    if (sentimentWord) {
      sentimentWord.addEventListener('click', function () {
        var firstClaim = app.querySelector('.claim');
        if (firstClaim) activateClaim(firstClaim);
      });
    }

    // history strip: click/select a day to see its date, sentiment, and whether
    // it was later scored a hit or a miss against what the market actually did
    var historyDetail = app.querySelector('.history-detail');
    function showHistoryDay(cell) {
      app.querySelectorAll('.history-cell.is-active').forEach(function (c) { c.classList.remove('is-active'); });
      cell.classList.add('is-active');
      if (!historyDetail) return;
      historyDetail.querySelector('.history-detail-date').textContent = fmtHistoryDate(cell.dataset.date);
      historyDetail.querySelector('.history-detail-sentiment').textContent = cell.dataset.sentiment;
      var result = cell.dataset.result;
      // "flat" is a real outcome, not a missing one: the market moved too little for a
      // directional call to be right or wrong, so the day is recorded and left out of the
      // accuracy tally. Kept distinct from "not yet scored", which means no verdict exists.
      var resultText = result === 'hit' ? '✓ correct call — market moved ' + cell.dataset.actualChange
        : result === 'miss' ? '✗ missed call — market moved ' + cell.dataset.actualChange
        : result === 'flat' ? '— too flat to judge — market moved only ' + cell.dataset.actualChange
        : 'not yet scored';
      historyDetail.querySelector('.history-detail-result').textContent = resultText;
      historyDetail.hidden = false;
    }
    app.querySelectorAll('.history-cell').forEach(function (cell) {
      cell.addEventListener('click', function () { showHistoryDay(cell); });
      cell.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); showHistoryDay(cell); }
      });
    });
  }

  function showError(message) {
    app.innerHTML = '';
    app.appendChild(el('p', 'state-msg', message));
  }

  function load(edition) {
    currentEdition = edition;
    app.innerHTML = '';
    app.appendChild(el('p', 'state-msg', "Loading today's ledger…"));
    fetch('data/latest-' + edition.toLowerCase() + '.json', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('No digest published yet for this edition.');
        return res.json();
      })
      .then(render)
      .catch(function (err) { showError(err.message || 'Could not load today’s ledger.'); });
  }

  if (toggle) {
    toggle.addEventListener('click', function (ev) {
      var btn = ev.target.closest('button[data-edition]');
      if (!btn) return;
      toggle.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      load(btn.dataset.edition);
    });
  }

  load(currentEdition);
})();
