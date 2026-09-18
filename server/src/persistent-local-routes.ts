import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { LocalRoute, LocalRouteStore, LocalQuote, QuoteRecord, RouteRecord } from './local-routes.js';
import { routeView } from './local-routes.js';

type PersistedStore = LocalRouteStore & { prepare: () => Promise<void>; persist: () => Promise<void> };

const asQuote = (row: any): QuoteRecord => ({
  id: String(row.id), sourceAmount: String(row.source_amount), sourceCurrency: 'NGN',
  destinationAmount: String(row.destination_amount), destinationAsset: 'USDC',
  feeAmount: String(row.fee_amount), rate: String(row.rate), purpose: row.purpose,
  provenance: 'sandbox', network: 'testnet', expiresAt: new Date(row.expires_at).toISOString(),
  used: Boolean(row.used_at), owner: String(row.owner_id ?? 'unbound'),
});

export function newPersistentLocalRouteStore(connectionString: string): PersistedStore {
  const db = new Client({ connectionString });
  const store = { quotes: new Map<string, QuoteRecord>(), routes: new Map<string, RouteRecord>(), idempotency: new Map<string, { digest: string; route: LocalRoute }>(), seenTransactions: new Set<string>() } as PersistedStore;

  store.prepare = async () => {
    await db.connect();
    await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    for (const version of ['001_initial', '002_local_routes']) {
      const sql = await readFile(resolve(process.cwd(), 'migrations', `${version}.sql`), 'utf8');
      await db.query(sql);
      await db.query('INSERT INTO schema_migrations(version) VALUES ($1) ON CONFLICT DO NOTHING', [version]);
    }
    const quotes = await db.query('SELECT * FROM local_quotes ORDER BY created_at ASC');
    for (const row of quotes.rows) store.quotes.set(String(row.id), asQuote(row));
    const routes = await db.query('SELECT * FROM local_routes ORDER BY created_at ASC');
    const events = await db.query('SELECT * FROM local_route_events ORDER BY created_at ASC');
    const byRoute = new Map<string, LocalRoute['events']>();
    for (const event of events.rows) { const list = byRoute.get(String(event.route_id)) ?? []; list.push({ status: event.status, at: new Date(event.created_at).toISOString(), note: event.note }); byRoute.set(String(event.route_id), list); }
    for (const row of routes.rows) {
      const quote = store.quotes.get(String(row.quote_id));
      if (!quote) continue;
      const { used: _used, owner: _owner, ...publicQuote } = quote;
      const route: RouteRecord = { id: String(row.id), quote: publicQuote, reference: row.reference, status: row.status, version: Number(row.version), createdAt: new Date(row.created_at).toISOString(), transactionHash: row.transaction_hash ?? undefined, events: byRoute.get(String(row.id)) ?? [], owner: String(row.owner_id), operatorOnly: false };
      store.routes.set(route.id, route);
      if (route.transactionHash) store.seenTransactions.add(route.transactionHash);
    }
    const keys = await db.query('SELECT * FROM local_route_idempotency');
    for (const row of keys.rows) { const route = store.routes.get(String(row.route_id)); if (route) store.idempotency.set(`${row.owner_id}:${row.idempotency_key}`, { digest: String(row.request_digest), route: routeView(route) }); }
  };

  store.persist = async () => {
    await db.query('BEGIN');
    try {
      for (const quote of store.quotes.values()) await db.query('INSERT INTO local_quotes (id,owner_id,source_amount,destination_amount,fee_amount,rate,purpose,expires_at,used_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET owner_id=EXCLUDED.owner_id,used_at=EXCLUDED.used_at', [quote.id, quote.owner === 'unbound' ? null : quote.owner, quote.sourceAmount, quote.destinationAmount, quote.feeAmount, quote.rate, quote.purpose, quote.expiresAt, quote.used ? new Date() : null]);
      for (const route of store.routes.values()) {
        await db.query('INSERT INTO local_routes (id,quote_id,owner_id,reference,status,version,transaction_hash,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,version=EXCLUDED.version,transaction_hash=EXCLUDED.transaction_hash', [route.id, route.quote.id, route.owner, route.reference, route.status, route.version, route.transactionHash ?? null, route.createdAt]);
        await db.query('DELETE FROM local_route_events WHERE route_id=$1', [route.id]);
        for (const event of route.events) await db.query('INSERT INTO local_route_events (id,route_id,status,note,created_at) VALUES ($1,$2,$3,$4,$5)', [randomUUID(), route.id, event.status, event.note, event.at]);
      }
      for (const [key, value] of store.idempotency) { const split = key.indexOf(':'); const owner = key.slice(0, split); const idem = key.slice(split + 1); await db.query('INSERT INTO local_route_idempotency (owner_id,idempotency_key,request_digest,route_id) VALUES ($1,$2,$3,$4) ON CONFLICT (owner_id,idempotency_key) DO NOTHING', [owner, idem, value.digest, value.route.id]); }
      await db.query('COMMIT');
    } catch (error) { await db.query('ROLLBACK'); throw error; }
  };
  return store;
}
