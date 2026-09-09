function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function oneLine(s){ return String(s).replace(/\s*\n+\s*/g, ' ').trim(); }

const inputJson = $input.first().json || {};
const e = inputJson.execution || {};
const err = e.error || {};
const wf = inputJson.workflow || {};

const triggerName = (e.executionContext && e.executionContext.triggerNode && e.executionContext.triggerNode.name) || 'Unknown trigger';
const failedNode = (err.node && err.node.name) || e.lastNodeExecuted || 'Unknown node';
const errMsg = oneLine(err.message || err.description || 'No error message available').slice(0, 300);
const execUrl = e.url || '';
const execId = e.id || 'n/a';
const nowIso = new Date().toISOString();
const line = '━'.repeat(26);

// ---- Telegram alert (HTML, escaped) ----
let alertMessage = '<b>🔴 MarketPulse Workflow Error</b>\n' + line + '\n\n';
alertMessage += '<b>Workflow:</b> <code>' + esc(wf.name || 'MarketPulse7am') + '</code>\n';
alertMessage += '<b>Trigger:</b> <code>' + esc(triggerName) + '</code>\n';
alertMessage += '<b>Failed Node:</b> <code>' + esc(failedNode) + '</code>\n\n';
alertMessage += '<b>Error:</b>\n' + esc(errMsg) + '\n\n';
if (execUrl) {
  alertMessage += '<a href="' + esc(execUrl).replace(/"/g, '&quot;') + '">View Execution #' + esc(execId) + '</a>\n\n';
}
alertMessage += 'Time: <code>' + esc(nowIso) + '</code>';

// ---- GitHub issue (Markdown) ----
const githubTitle = 'MarketPulse error: ' + failedNode + ' (' + triggerName + ')';
let githubBody = '**Workflow:** `' + (wf.name || 'MarketPulse7am') + '`\n';
githubBody += '**Trigger:** `' + triggerName + '`\n';
githubBody += '**Failed Node:** `' + failedNode + '`\n\n';
githubBody += '**Error:**\n```\n' + errMsg + '\n```\n\n';
if (execUrl) githubBody += '[View Execution #' + execId + '](' + execUrl + ')\n\n';
githubBody += 'Time: `' + nowIso + '`\n\n_Filed automatically by the MarketPulse error-alert workflow._';

return [{ json: { alertMessage, githubTitle, githubBody } }];
