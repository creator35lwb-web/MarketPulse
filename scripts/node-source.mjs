import { readFileSync } from 'node:fs';

export const repositoryRoot = new URL('../', import.meta.url);
export const readSourceText = (path, root = repositoryRoot) => readFileSync(new URL(path, root), 'utf8').replaceAll('\r\n', '\n');
export const readNodeSources = (root = repositoryRoot) => JSON.parse(readSourceText('scripts/node-sources.json', root));

// Shared bodies are included once, in declared order, before the node wrapper.
// All inputs are checked-in source files; this resolver never evaluates them.
export function resolveNodeSource(name, root = repositoryRoot) {
  const descriptor = readNodeSources(root)[name];
  if (!descriptor || typeof descriptor.policy !== 'boolean' || !Array.isArray(descriptor.includes ?? [])) {
    throw new Error('Missing or invalid node source descriptor: ' + name);
  }
  const order = [...(descriptor.policy ? ['analysis-policy.js'] : []), ...(descriptor.includes ?? []), descriptor.file];
  const files = {};
  for (const file of order) {
    if (typeof file !== 'string' || !/^[a-z0-9-]+\.js$/.test(file)) throw new Error('Invalid node source filename');
    if (!Object.hasOwn(files, file)) files[file] = readSourceText('src/n8n/' + file, root).trimEnd();
  }
  return { code: Object.values(files).join('\n\n') + '\n', files };
}

export const buildNodeSource = (name, root = repositoryRoot) => resolveNodeSource(name, root).code;
