import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeBackend } from './liveApi';
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe('read-only backend probe', () => {
  it('does not call a server when the API base is not configured', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ''); const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(probeBackend()).resolves.toMatchObject({ configured: false, reasonCodes: ['API_NOT_CONFIGURED'] }); expect(fetchMock).not.toHaveBeenCalled();
  });
  it('reports reachable-but-not-ready reasons', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:8787/'); vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{"ok":true}', {status:200})).mockResolvedValueOnce(new Response('{"capabilities":{"reasonCodes":["POLLAR_NOT_CONFIGURED"]}}', {status:503})));
    await expect(probeBackend()).resolves.toMatchObject({ configured: true, reachable: true, ready: false, reasonCodes: ['POLLAR_NOT_CONFIGURED'] });
  });
  it('fails closed on network errors', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:8787'); vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(probeBackend()).resolves.toMatchObject({ configured: true, reachable: false, ready: false, reasonCodes: ['BACKEND_UNREACHABLE'] });
  });
});
