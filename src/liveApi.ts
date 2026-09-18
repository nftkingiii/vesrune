export interface BackendProbe {
  configured: boolean;
  reachable: boolean;
  ready: boolean;
  reasonCodes: string[];
  message: string;
}
type CapabilityResponse = { capabilities?: { reasonCodes?: string[] } };
const baseUrl = () => import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') || '';
async function readJson(url: string, signal: AbortSignal) {
  const response = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' }, signal });
  let body: CapabilityResponse = {};
  try { body = await response.json() as CapabilityResponse; } catch { /* the HTTP status still informs the probe */ }
  return { status: response.status, body };
}
/** Read-only capability probe. It never sends wallet credentials or mutation requests. */
export async function probeBackend(signal?: AbortSignal): Promise<BackendProbe> {
  const base = baseUrl();
  if (!base) return { configured: false, reachable: false, ready: false, reasonCodes: ['API_NOT_CONFIGURED'], message: 'Add VITE_API_BASE_URL when the backend is ready to wire.' };
  try {
    const health = await readJson(`${base}/healthz`, signal ?? new AbortController().signal);
    if (health.status < 200 || health.status >= 300) return { configured: true, reachable: true, ready: false, reasonCodes: ['HEALTH_CHECK_FAILED'], message: 'Backend responded but health is not available.' };
    const ready = await readJson(`${base}/readyz`, signal ?? new AbortController().signal);
    return { configured: true, reachable: true, ready: ready.status === 200, reasonCodes: ready.body.capabilities?.reasonCodes ?? (ready.status === 200 ? [] : ['BACKEND_NOT_READY']), message: ready.status === 200 ? 'Backend is ready for configured capabilities.' : 'Backend is reachable but live capabilities are not ready.' };
  } catch {
    if (signal?.aborted) throw new DOMException('Probe aborted', 'AbortError');
    return { configured: true, reachable: false, ready: false, reasonCodes: ['BACKEND_UNREACHABLE'], message: 'Backend could not be reached. Preview remains local and unchanged.' };
  }
}
