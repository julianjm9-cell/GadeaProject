import { randomUUID } from 'node:crypto';
import { jsonRequest, OperationError } from './operations.mjs';

const origin = 'https://educame.tech';
const cookie = 'educame_local_admin';
const maxAge = 30 * 60;
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const products = new Set(['PROFESOR_PARTICULAR', 'ESO_ADULTOS', 'CAMBRIDGE', 'DIPLOMATOR', 'OCR_FACTURAS', 'UNIVERSIDAD_ADULTOS']);
const fields = ['email', 'full_name', 'is_active'];
const accessFields = ['license_id', 'status', 'plan', 'expires_at', 'total_credits', 'access_role'];
const matches = (current, expected, keys) => Boolean(expected) && keys.every(key => current?.[key] === expected[key]);
const string = (value, max) => typeof value === 'string' && value.length <= max;
const email = value => string(value, 255) && /^[^\s@]+@[^\s@]+$/.test(value);
const sameState = () => new OperationError(409, 'Los datos han cambiado. Actualiza y revisa de nuevo.');

export function adminOperations(fetchImpl = fetch) {
  const sessions = new Map();
  let writing = false;
  const request = (path, token, method = 'GET', data) => jsonRequest(fetchImpl, origin + path,
    { token, method, data, label: 'Administración de Educame' });

  async function handle(action, cookieHeader, body, response) {
    const sid = new RegExp('(?:^|;\\s*)' + cookie + '=([0-9a-f-]{36})(?:;|$)').exec(cookieHeader || '')?.[1];
    const session = sessions.get(sid);
    const setCookie = (id, seconds) => response.setHeader('Set-Cookie',
      `${cookie}=${id}; Path=/api/operacion/admin; Max-Age=${seconds}; HttpOnly; SameSite=Strict`);
    if (action === 'login') {
      if (!string(body.identifier, 255) || !body.identifier.trim() || !string(body.password, 512) || !body.password) {
        throw new OperationError(400, 'Introduce el identificador y la contraseña del administrador.');
      }
      const result = await request('/auth/login', null, 'POST', { identifier: body.identifier.trim(), password: body.password });
      const token = result.access_token;
      if (typeof token !== 'string' || !token) throw new OperationError(502, 'La administración no devolvió una sesión.');
      try { await request('/admin/app-availability', token); }
      catch (error) { await request('/auth/logout', token, 'POST').catch(() => {}); throw error; }
      if (session) await request('/auth/logout', session.token, 'POST').catch(() => {});
      for (const [key, value] of sessions) if (value.expires <= Date.now()) sessions.delete(key);
      sessions.delete(sid);
      const id = randomUUID();
      sessions.set(id, { token, expires: Date.now() + maxAge * 1000 });
      setCookie(id, maxAge);
      return { connected: true };
    }
    if (action === 'logout') {
      sessions.delete(sid);
      setCookie('', 0);
      if (session) await request('/auth/logout', session.token, 'POST').catch(() => {});
      return { connected: false };
    }
    if (!session || session.expires <= Date.now()) {
      sessions.delete(sid);
      if (action === 'state') return { connected: false };
      throw new OperationError(401, 'Entra con tu cuenta de administración.');
    }
    const call = (path, method, data) => request(path, session.token, method, data);
    try {
      if (action === 'state') {
        const [accounts, organizations, apps] = await Promise.all([
          call('/admin/accounts'), call('/admin/organizations'), call('/admin/app-availability'),
        ]);
        return { connected: true, accounts: accounts.accounts, organizations: organizations.map(({ id, name }) => ({ id, name })), apps };
      }
      if (writing) throw new OperationError(409, 'Hay otro cambio de administración en curso.');
      writing = true;
      try { return await update(action, body, call); }
      finally { writing = false; }
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        sessions.delete(sid);
        setCookie('', 0);
        if (action === 'state') return { connected: false };
      }
      throw error;
    }
  }
  return { handle };
}

async function update(action, body, call) {
  if (action === 'pause') {
    const { product, paused, expected } = body;
    const apps = await call('/admin/app-availability');
    if (!Object.hasOwn(apps, product) || typeof paused !== 'boolean' || typeof expected !== 'boolean') {
      throw new OperationError(400, 'Selecciona la aplicación y su estado.');
    }
    if (apps[product].paused === paused) return { paused };
    if (apps[product].paused !== expected) throw sameState();
    return call('/admin/app-availability/' + product, 'PATCH', { paused });
  }
  if (action === 'create-account') {
    if (!uuid.test(body.organization_id || '') || !email(body.email) || !string(body.full_name, 255) ||
      !string(body.password, 72) || Buffer.byteLength(body.password) > 72 || body.password.length < 8) {
      throw new OperationError(400, 'Revisa la organización, el correo, el nombre y la contraseña inicial (8 a 72 bytes).');
    }
    return call('/admin/users', 'POST', { organization_id: body.organization_id, email: body.email,
      full_name: body.full_name, password: body.password, role: 'user', is_active: true });
  }
  if (!uuid.test(body.id || '')) throw new OperationError(400, 'Selecciona una cuenta.');
  const path = '/admin/users/' + body.id;
  if (action === 'account') {
    if (!email(body.email) || !string(body.full_name, 255) || typeof body.is_active !== 'boolean') {
      throw new OperationError(400, 'Revisa el nombre, correo y estado de la cuenta.');
    }
    const current = await call(path);
    if (current.role !== 'user') throw new OperationError(409, 'Edita las cuentas de administración desde el panel online.');
    if (!matches(current, body.expected, fields)) throw sameState();
    const changes = Object.fromEntries(fields.filter(key => current[key] !== body[key]).map(key => [key, body[key]]));
    return Object.keys(changes).length ? call(path, 'PATCH', changes) : current;
  }
  const { product, status, plan, access_role, expires_at, usage_limit, expected } = body;
  const expiry = typeof expires_at === 'string' && Date.parse(expires_at);
  if (!products.has(product) || !['active', 'suspended', 'expired'].includes(status) || !Number.isFinite(expiry) ||
    !Number.isInteger(usage_limit) || usage_limit < 0 || usage_limit > 2147483647 ||
    (product === 'PROFESOR_PARTICULAR' && !['PROFESOR_FREE', 'PROFESOR_PREMIUM'].includes(plan)) ||
    (product === 'OCR_FACTURAS' && !['user', 'admin'].includes(access_role))) {
    throw new OperationError(400, 'Revisa la aplicación, el estado, el plan, el vencimiento y los créditos.');
  }
  const { accounts } = await call('/admin/accounts');
  const account = accounts.find(value => value.id === body.id);
  if (!account) throw new OperationError(404, 'La cuenta ya no está disponible.');
  const access = account.accesses.find(value => value.product_code === product);
  const data = { status, expires_at: new Date(expiry).toISOString(), usage_limit,
    ...(product === 'PROFESOR_PARTICULAR' && { plan }), ...(product === 'OCR_FACTURAS' && { access_role }) };
  if (access) {
    if (!matches(access, expected, accessFields)) throw sameState();
    return call(path + '/access/' + product, 'PATCH', data);
  }
  if (expected) throw sameState();
  if (expiry <= Date.now()) throw new OperationError(400, 'El vencimiento de una licencia nueva debe ser posterior a hoy.');
  await call('/admin/licenses', 'POST', { ...data, organization_id: account.organization_id, user_id: account.id,
    product_code: product, plan: data.plan || 'MVP', access_role: data.access_role || 'user', starts_at: new Date().toISOString() });
  return { created: true };
}
