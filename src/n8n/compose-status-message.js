// ============================================
// MoatPillar Service Status Message Composer
// Professional investment channel notifications
// HTML-styled + escaped (2026-07-10)
// ============================================

try { require('dns').setDefaultResultOrder('ipv4first'); } catch(e) {}

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const statusType = ($input.first().json.statusType || 'restored').toLowerCase().trim();
const customNote = $input.first().json.customNote || '';
const now = new Date();
const dateStr = now.toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});
const timeStr = now.toLocaleTimeString('en-US', {
  hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur', timeZoneName: 'short'
});

const line = '━'.repeat(26);

const messages = {

  restored: [
    '<b>✅ MoatPillar Service Restored</b>',
    line,
    '📅 ' + dateStr,
    '⏰ ' + timeStr,
    '',
    'Dear Subscribers,',
    '',
    'We are pleased to inform you that MoatPillar daily brief services have been fully restored following a brief infrastructure maintenance period.',
    '',
    'During this time, our engineering team addressed connectivity optimizations to ensure more reliable data delivery from our market intelligence sources. All systems are now operating normally.',
    '',
    'What was addressed:',
    '• Network connectivity enhancements for improved reliability',
    '• API communication layer optimization',
    '• Service resilience improvements with automatic failover',
    '',
    'Your daily market briefing will resume with the next scheduled delivery. All market data feeds, including the Value Investor Dashboard, economic indicators, and AI-powered analysis, are fully operational.',
    '',
    'We appreciate your patience and continued trust in MoatPillar as your daily market intelligence partner.',
  ],

  maintenance: [
    '<b>🔧 MoatPillar Scheduled Maintenance</b>',
    line,
    '📅 ' + dateStr,
    '⏰ ' + timeStr,
    '',
    'Dear Subscribers,',
    '',
    'We would like to inform you that MoatPillar will be undergoing scheduled infrastructure maintenance to enhance service reliability and performance.',
    '',
    'During this period, daily digest delivery may be temporarily paused. We anticipate a brief maintenance window and will notify you upon service restoration.',
    '',
    'No action is required on your part. Your subscription and preferences remain unchanged.',
    '',
    'Thank you for your understanding.',
  ],

  degraded: [
    '<b>⚠️ MoatPillar Service Notice</b>',
    line,
    '📅 ' + dateStr,
    '⏰ ' + timeStr,
    '',
    'Dear Subscribers,',
    '',
    'Please be advised that MoatPillar is currently experiencing intermittent connectivity with select data providers. Your daily digest may contain partial data for some indicators.',
    '',
    'Our team is actively monitoring the situation and working to restore full data coverage. Core market sentiment analysis and AI-powered insights remain operational.',
    '',
    'We will provide an update once all systems are fully restored.',
    '',
    'Thank you for your patience.',
  ],

  scheduled_downtime: [
    '<b>📋 MoatPillar Advance Notice</b>',
    line,
    '📅 ' + dateStr,
    '⏰ ' + timeStr,
    '',
    'Dear Subscribers,',
    '',
    'This is an advance notice that MoatPillar services will undergo planned system upgrades to bring you enhanced features and improved reliability.',
    '',
    'Scheduled maintenance window details will be communicated separately. We are committed to minimizing any disruption to your daily market intelligence delivery.',
    '',
    'Thank you for being a valued subscriber.',
  ],

  unavailable: [
    '<b>💤 MoatPillar Temporarily Unavailable</b>',
    line,
    '📅 ' + dateStr,
    '⏰ ' + timeStr,
    '',
    'Dear Subscribers,',
    '',
    'We apologize for the inconvenience. MoatPillar is temporarily unavailable at this time, as our team is currently offline. Service will resume as soon as we are back online.',
    '',
    'If you have an urgent question or need a quick response in the meantime, please feel free to reach us here: https://github.com/YOUR_GITHUB_USERNAME/MarketPulse/issues',
    '',
    'Thank you for your patience. We will be back shortly.',
  ]

};

const lines = messages[statusType] || messages.restored;

// Add custom note if provided - escaped, since this is free text typed by a human into
// the form and must not be trusted as-is (could otherwise break Telegram's HTML parser).
if (customNote && customNote.trim().length > 0) {
  lines.push('');
  lines.push('<b>Additional Note:</b>');
  lines.push('<i>' + esc(customNote.trim()) + '</i>');
}

// Add footer with status indicator
const statusIndicator = {
  restored: '🟢 Operational',
  maintenance: '🟡 Under Maintenance',
  degraded: '🟠 Degraded Performance',
  scheduled_downtime: '🔵 Scheduled Downtime',
  unavailable: '⚫ Temporarily Offline'
};
lines.push('');
lines.push(line);
lines.push('<b>' + (statusIndicator[statusType] || '⚪ Unknown') + ' | MoatPillar</b>');

const message = lines.join('\n');

return [{ json: { message, statusType, timestamp: now.toISOString() } }];
