import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/g, '\n');
const hash = text => createHash('sha256').update(text).digest('hex');
const template = JSON.parse(read('scripts/workflow-template.json'));
const sources = JSON.parse(read('scripts/node-sources.json'));
const policy = read('src/n8n/analysis-policy.js').replace(/\r\n/g, '\n').trimEnd();
const sourceHashes = {'analysis-policy.js': hash(policy)};
const contract = read('scripts/analysis-contract.txt').replace(/\r\n/g, '\n').trimEnd();
sourceHashes['scripts/analysis-contract.txt'] = hash(contract);
const analystNames = ['Basic LLM Chain','China Market LLM Chain','Groq Analyst','Groq Analyst1'];
for (const name of analystNames) {
  const node = template.nodes.find(n => n.name === name);
  if (!node || typeof node.parameters.text !== 'string') throw new Error('Missing analyst prompt: ' + name);
  const original = node.parameters.text.split('\n\n== PUBLICATION CONTRACT v1 ==')[0];
  node.parameters.text = original.trimEnd() + '\n\n' + contract;
}
const seen = new Set();
for (const node of template.nodes) {
  const source = sources[node.name];
  if (node.type === 'n8n-nodes-base.code' && !source) throw new Error('Missing editable source for ' + node.name);
  if (!source) continue;
  if (!/^[a-z0-9-]+\.js$/.test(source.file)) throw new Error('Invalid source filename');
  const body = read('src/n8n/' + source.file).replace(/\r\n/g, '\n').trimEnd();
  sourceHashes[source.file] = hash(body);
  node.parameters.jsCode = (source.policy ? policy + '\n\n' : '') + body + '\n';
  new vm.Script('(async function(){\n' + node.parameters.jsCode + '\n})');
  seen.add(node.name);
}
for (const name of Object.keys(sources)) if (!seen.has(name)) throw new Error('Source refers to missing node ' + name);
if (template.active !== false || template.staticData || template.pinData || template.id) throw new Error('Public export must not contain live state');
for (const node of template.nodes) {
  for (const credential of Object.values(node.credentials || {})) {
    if (!credential.id?.startsWith('YOUR_') || !credential.name?.startsWith('YOUR_')) throw new Error('Credential reference not sanitized: ' + node.name);
  }
  if (node.parameters.chatId && !String(node.parameters.chatId).startsWith('YOUR_')) throw new Error('Chat destination not sanitized');
}
const workflow = JSON.stringify(template, null, 2) + '\n';
const secrets = [
  /AIza[\w-]{30,}/, /gsk_[\w-]{20,}/, /gh[pousr]_[\w]{20,}/, /github_pat_[\w]{20,}/,
  /\d{8,12}:AA[\w-]{30,}/, /FRED_API_KEY\s*=\s*['"][a-f0-9]{32}['"]/i,
];
function scanStrings(value) {
  if (typeof value === 'string' && secrets.some(pattern => pattern.test(value))) throw new Error('Secret-shaped content detected; export not written');
  if (value && typeof value === 'object') for (const child of Object.values(value)) scanStrings(child);
}
scanStrings(template);
const manifest = JSON.stringify({formatVersion:1, contractVersion:2, exportDate:'2026-09-10',
  nodeCount:template.nodes.length, workflowSha256:hash(workflow), sources:sourceHashes}, null, 2) + '\n';
const artifacts = {
  'MarketPulse-Secure/workflows/marketpulse-workflow-CURRENT.json': workflow,
  'MarketPulse-Secure/workflows/workflow-manifest.json': manifest,
};
for (const [path, content] of Object.entries(artifacts)) {
  if (process.argv.includes('--check')) {
    if (read(path) !== content) throw new Error(path + ' is stale; run node scripts/build-workflow.mjs');
  } else writeFileSync(new URL(path, root), content);
}
console.log('Workflow ' + (process.argv.includes('--check') ? 'verified' : 'built') + ': ' + template.nodes.length + ' nodes; source hash ' + hash(workflow));
