export class OperationError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const revisionPattern = /^[a-f0-9]{40}$/;

export async function jsonRequest(fetchImpl, url, { method = 'GET', token, data, headers, label }) {
  const response = await fetchImpl(url, {
    method, redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { Accept: 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  }).catch(() => { throw new OperationError(502, `No se pudo confirmar la respuesta de ${label}. Actualiza el estado antes de repetir.`); });
  const value = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof value?.detail === 'string' ? value.detail : value?.message;
    throw new OperationError(response.status, typeof detail === 'string' ? detail.slice(0, 300) : `${label} respondió HTTP ${response.status}.`);
  }
  if (!value && response.status !== 204) throw new OperationError(502, `${label} devolvió una respuesta inesperada.`);
  return value;
}
