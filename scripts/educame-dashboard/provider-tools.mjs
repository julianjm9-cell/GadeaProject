import { lstat, mkdir, readFile, realpath, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname, join, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';

const privatePath = /(^|\/)(?:(?:\.git|\.educame-agents|node_modules|backups)(?:\/|$)|\.env(?:[.-].*)?(?:\/|$)|(?:secrets|credentials)(?:[./]|$)|(?:\.connections-key|connections-vault\.json|auth\.json)$)|\.(?:pem|key|p12|pfx|sqlite|dump)$/i;
const properties = {
  list_files: { description: 'Lista archivos de código permitidos. Usa un prefijo para acotar y offset para paginar.', fields: { prefix: { type: 'string' }, offset: { type: 'integer' } } },
  read_file: { description: 'Lee líneas de un archivo permitido, hasta 240 líneas por llamada.', fields: { path: { type: 'string' }, start: { type: 'integer' }, count: { type: 'integer' } } },
  search_code: { description: 'Busca texto literal en los archivos permitidos.', fields: { text: { type: 'string' }, prefix: { type: 'string' } } },
  write_file: { description: 'Crea o reemplaza un archivo de texto en la copia aislada. No permite secretos ni enlaces.', fields: { path: { type: 'string' }, content: { type: 'string' } } },
  replace_text: { description: 'Edita un fragmento único sin reescribir archivos grandes. Lee antes el archivo para obtener revision; una revisión distinta o un fragmento ambiguo bloquea el cambio.',
    fields: { path: { type: 'string' }, old_text: { type: 'string' }, new_text: { type: 'string' }, expected_revision: { type: 'string' } } },
  run_tests: { description: 'Ejecuta una comprobación de Node o pytest compatible. No admite comandos de shell ni Git.', fields: { command: { type: 'string' } } },
};

export async function createProviderTools({ cwd, allowed, writable = false, runChecks }) {
  const root = await realpath(cwd);
  const checks = new Map();
  const revision = text => createHash('sha256').update(text).digest('hex');
  const permitted = path => !privatePath.test(path) && allowed.some(prefix => /\.[a-z0-9]+$/i.test(prefix) ? path === prefix : path.startsWith(prefix));
  const safe = async (path, create = false) => {
    if (typeof path !== 'string' || !path || path.includes('\\') || path.includes(':') || path.includes('\0') || isAbsolute(path) ||
        path.split('/').some(part => ['..', '.', ''].includes(part)) || !permitted(path)) throw new Error('Ruta fuera del ámbito permitido.');
    const target = resolve(root, path);
    let current = root;
    for (const [index, part] of path.split('/').entries()) {
      current = join(current, part);
      const entry = await lstat(current).catch(error => { if (error.code !== 'ENOENT' || !create) throw error; });
      if (!entry) continue;
      if (entry.isSymbolicLink() || (index < path.split('/').length - 1 && !entry.isDirectory()) ||
          relative(root, await realpath(current)).startsWith('..')) throw new Error('No se permiten enlaces ni rutas externas.');
    }
    return target;
  };
  let files;
  async function list() {
    if (files) return files;
    const result = [];
    async function visit(directory, prefix = '') {
      if (result.length >= 12000) return;
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = prefix + entry.name;
        if (privatePath.test(path) || entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          if (allowed.some(scope => scope.startsWith(path + '/') || path.startsWith(scope))) await visit(join(directory, entry.name), path + '/');
        } else if (entry.isFile() && permitted(path)) result.push(path);
      }
    }
    await visit(root); files = result.sort(); return files;
  }
  async function content(path) {
    const target = await safe(path);
    const stat = await lstat(target);
    if (!stat.isFile() || stat.size > 700000 || /\.(?:png|jpg|jpeg|webp|gif|wav|mp3|mp4|pdf|zip|ico|woff2?)$/i.test(path)) throw new Error('Elige un archivo de texto de menos de 700 KB.');
    const text = await readFile(target, 'utf8');
    if (text.includes('\0')) throw new Error('El archivo no es texto.');
    return text;
  }
  const names = Object.keys(properties).filter(name => writable || !['write_file', 'replace_text', 'run_tests'].includes(name));
  const definitions = names.map(name => ({ name, description: properties[name].description,
    parameters: { type: 'object', properties: properties[name].fields, required: Object.keys(properties[name].fields), additionalProperties: false } }));
  async function execute(name, args) {
    if (!names.includes(name) || !args || typeof args !== 'object') return { error: 'Herramienta no disponible.' };
    try {
      if (name === 'list_files') {
        const selected = (await list()).filter(path => path.startsWith(typeof args.prefix === 'string' ? args.prefix : ''));
        const offset = Number.isInteger(args.offset) && args.offset >= 0 ? args.offset : 0;
        return { files: selected.slice(offset, offset + 180), total: selected.length };
      }
      if (name === 'read_file') {
        const text = await content(args.path), lines = text.split('\n'), start = Math.max(1, Math.trunc(args.start) || 1);
        const count = Math.min(240, Math.max(1, Math.trunc(args.count) || 100));
        return { text: lines.slice(start - 1, start - 1 + count).map((line, index) => `${start + index}: ${line}`).join('\n').slice(0, 22000), totalLines: lines.length, revision: revision(text) };
      }
      if (name === 'search_code') {
        if (typeof args.text !== 'string' || !args.text || args.text.length > 200) throw new Error('Busca un texto literal de hasta 200 caracteres.');
        const matches = [];
        for (const path of (await list()).filter(path => path.startsWith(args.prefix || '')).slice(0, 1500)) {
          const text = await content(path).catch(() => '');
          for (const [index, line] of text.split('\n').entries()) if (line.includes(args.text)) matches.push({ path, line: index + 1, text: line.slice(0, 350) });
          if (matches.length >= 70) break;
        }
        return { matches: matches.slice(0, 70) };
      }
      if (name === 'replace_text') {
        const text = await content(args.path);
        if (revision(text) !== args.expected_revision) throw new Error('El archivo cambió después de leerlo. Vuelve a leer antes de editar.');
        if (typeof args.old_text !== 'string' || !args.old_text || args.old_text.length > 22000 ||
            typeof args.new_text !== 'string' || args.new_text.length > 44000 || text.split(args.old_text).length !== 2) throw new Error('El fragmento debe existir una sola vez. Lee y acota mejor el cambio.');
        args = { path: args.path, content: text.replace(args.old_text, () => args.new_text) };
      }
      if (name === 'write_file' || name === 'replace_text') {
        if (typeof args.content !== 'string' || Buffer.byteLength(args.content) > 700000 || args.content.includes('\0') ||
            /-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:sk-|ghp_|github_pat_|AIza)[A-Za-z0-9_-]{20,}/.test(args.content)) throw new Error('El contenido no es un archivo de código permitido.');
        const target = await safe(args.path, true);
        await mkdir(dirname(target), { recursive: true });
        await safe(args.path, true);
        await writeFile(target, args.content, { flag: 'w' }); files = undefined;
        return { written: args.path };
      }
      if (name === 'run_tests') {
        if (!runChecks || typeof args.command !== 'string' || args.command.length > 500) throw new Error('La comprobación no está disponible.');
        const result = await runChecks(cwd, [args.command]);
        for (const check of result) checks.set(check.command, check);
        return { checks: result };
      }
    } catch (error) { return { error: error.code ? 'No se pudo acceder al archivo o ejecutar la comprobación.' : error.message }; }
  }
  return { definitions, execute, checks: () => [...checks.values()] };
}
