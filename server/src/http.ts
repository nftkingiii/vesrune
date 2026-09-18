import { createHash, randomUUID } from 'node:crypto';
import { createServer, IncomingMessage } from 'node:http';
import { AppError } from './errors.js';
import { unavailablePollarCapability } from './pollar/capabilities.js';
import * as lr from './local-routes.js';
import { verifyPollarSession } from './pollar/session.js';

type PersistableStore = lr.LocalRouteStore & { persist?: () => Promise<void> };
export type HttpOptions = {
  health?: () => Promise<{ ready: boolean; capabilities: ReturnType<typeof unavailablePollarCapability> }>;
  allowedOrigins?: string[];
  pollar?: { verifyUrl?: string; serverApiKey?: string };
  localRoutes?: { store: PersistableStore; identityEnabled: boolean; verifySettlement?: (p: lr.SettlementProof, q: lr.LocalQuote) => boolean | Promise<boolean> };
};

async function body(req: IncomingMessage) { let value = ''; for await (const chunk of req) { value += chunk; if (value.length > 1_000_000) throw new AppError('VALIDATION_ERROR', 'Request body too large'); } try { return value ? JSON.parse(value) : undefined; } catch { throw new AppError('VALIDATION_ERROR', 'Invalid JSON'); } }
function json(res: any, status: number, value: unknown) { res.statusCode = status; res.end(JSON.stringify(value)); }
function owner(req: IncomingMessage, opts: HttpOptions) { const id = opts.localRoutes?.identityEnabled ? req.headers['x-sandbox-owner'] : undefined; if (typeof id !== 'string' || !id) throw new AppError('UNAUTHENTICATED', 'Sandbox identity mode is disabled or no loopback identity was supplied'); return id; }
function operator(req: IncomingMessage) { if (req.headers['x-sandbox-role'] !== 'operator') throw new AppError('FORBIDDEN', 'Operator authorization required'); return 'operator'; }

export function makeServer(options: HttpOptions = {}) {
  return createServer(async (req, res) => {
    const requestId = randomUUID(); const origin = req.headers.origin;
    if (origin && options.allowedOrigins?.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Credentials', 'true'); res.setHeader('Vary', 'Origin'); }
    res.setHeader('X-Request-Id', requestId); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Content-Type', 'application/json');
    try {
      if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Authorization,DPoP,DPoP-Nonce,Content-Type,Idempotency-Key,X-Sandbox-Owner,X-Sandbox-Role'); return json(res, 204, ''); }
      if (req.url === '/healthz' && req.method === 'GET') return json(res, 200, { ok: true, requestId });
      if (req.url === '/readyz' && req.method === 'GET') { const ready = options.health ? await options.health() : { ready: false, capabilities: unavailablePollarCapability() }; return json(res, ready.ready ? 200 : 503, { ...ready, requestId }); }
      if (req.url === '/v1/earn/opportunities' && req.method === 'GET') return json(res, 200, { opportunities: [], capabilities: unavailablePollarCapability(), requestId });
      if (req.method === 'POST' && req.url === '/v1/auth/session') {
        await body(req);
        const session = await verifyPollarSession({ authorization: header(req, 'authorization'), dpop: header(req, 'dpop'), nonce: header(req, 'dpop-nonce') }, options.pollar ?? {});
        return json(res, 200, { authenticated: true, subject: session.subject, wallet: session.walletAddress ? { address: session.walletAddress, type: session.walletType, network: session.network } : null, requestId });
      }
      const route = options.localRoutes;
      if (req.url?.startsWith('/api/local-routes') && route) {
        const clean = req.url.split('?')[0] ?? ''; const parts = clean.split('/').filter(Boolean); const id = parts[2]; const action = parts[3]; const save = async () => { await route.store.persist?.(); };
        if (req.method === 'GET' && parts.length === 3 && parts[2] === 'capabilities') return json(res, 200, { sandbox: true, network: 'testnet', corridor: 'NGN bank transfer -> USDC', rate: '1500', fee: '1%', identityMode: route.identityEnabled, reasonCodes: route.identityEnabled ? ['SANDBOX_ONLY', 'BOB_PROVIDER_MOCKED'] : ['AUTH_UNAVAILABLE', 'POLLAR_SETTLEMENT_UNVERIFIED'] });
        if (req.method === 'POST' && parts.length === 3 && parts[2] === 'quotes') { const input = await body(req); const result = lr.createQuote(route.store, input?.sourceAmount, input?.purpose); await save(); return json(res, 201, result); }
        if (req.method === 'POST' && parts.length === 2) { const input = await body(req); const key = req.headers['idempotency-key']; if (typeof key !== 'string' || !key) throw new AppError('VALIDATION_ERROR', 'Idempotency-Key is required'); const result = lr.createRoute(route.store, String(input?.quoteId), owner(req, options), key); await save(); return json(res, 201, result); }
        if (req.method === 'GET' && parts.length === 2) return json(res, 200, lr.listRoutes(route.store, owner(req, options)));
        if (req.method === 'GET' && parts.length === 3) return json(res, 200, lr.getRoute(route.store, id!, owner(req, options)));
        if (req.method === 'POST' && parts.length === 4) {
          const input = await body(req); const currentOwner = owner(req, options); let result: lr.LocalRoute;
          if (action === 'evidence') result = lr.addEvidence(route.store, id!, currentOwner, input?.reference, input?.expectedVersion);
          else if (action === 'review') { operator(req); result = lr.review(route.store, id!, input?.decision, input?.reason, input?.expectedVersion, 'operator'); }
          else if (action === 'settlement') result = await lr.settleAsync(route.store, id!, currentOwner, { ...input, network: 'testnet' }, input?.expectedVersion, route.verifySettlement ?? (() => false));
          else if (action === 'simulate-payout') result = lr.simulatePayout(route.store, id!, currentOwner, input?.expectedVersion);
          else if (action === 'cancel') result = lr.cancel(route.store, id!, currentOwner, input?.expectedVersion);
          else return json(res, 404, { error: { code: 'VALIDATION_ERROR', message: 'Route not found', retryable: false, requestId } });
          await save(); return json(res, 200, result);
        }
      }
      return json(res, 404, { error: { code: 'VALIDATION_ERROR', message: 'Route not found', retryable: false, requestId } });
    } catch (error) { const appError = error instanceof AppError ? error : new AppError('VALIDATION_ERROR', 'Request could not be processed'); return json(res, appError.code === 'UNAUTHENTICATED' ? 401 : appError.code === 'FORBIDDEN' ? 403 : 422, { error: { code: appError.code, message: appError.message, retryable: appError.retryable, requestId, fieldErrors: appError.fieldErrors } }); }
  });
}
function header(req: IncomingMessage, key: string) { const value = req.headers[key]; return typeof value === 'string' ? value : undefined; }
export function digest(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
