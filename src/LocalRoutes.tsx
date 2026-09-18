import { useEffect, useState } from 'react';
import { ArrowRight, Check, Globe2, Landmark, ShieldCheck, Wallet } from 'lucide-react';
import { usePollar } from '@pollar/react';
import type { SendPaymentParams } from '@pollar/core';
import type { LocalRoute, LocalRouteStatus, RoutePurpose } from '../shared/localRoutes';
import './localRoutes.css';
import './routePayment.css';

const labels: Record<LocalRouteStatus, string> = { awaiting_funding: 'Awaiting sandbox funding', under_review: 'Operator review', awaiting_settlement: 'Awaiting testnet proof', settled: 'Testnet settled', payout_simulated: 'BOB payout simulated', rejected: 'Rejected', cancelled: 'Cancelled', refund_required: 'Refund review required' };
const purposes = { wallet: 'Keep in wallet', earn: 'Prepare for Earn', bolivia: 'Send to Bolivia' };
const apiBase = () => import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') || '';
const routeDestination = () => import.meta.env.VITE_ROUTE_SETTLEMENT_WALLET?.trim() || '';
const sandboxOwner = () => { const key = 'vesrune-sandbox-owner'; const existing = sessionStorage.getItem(key); if (existing) return existing; const value = `demo-${crypto.randomUUID()}`; sessionStorage.setItem(key, value); return value; };
async function api<T>(path: string, init?: RequestInit): Promise<T> { const base = apiBase(); if (!base) throw new Error('Backend URL is not configured. Preview mode remains available locally.'); const response = await fetch(`${base}${path}`, { ...init, credentials: 'include', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Sandbox-Owner': sandboxOwner(), ...(init?.headers || {}) } }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body?.error?.message || `Backend request failed (${response.status}).`); return body as T; }

function LiveRoutePayment({ route, busy, onBusy, onError, onVerified }: { route: LocalRoute; busy: boolean; onBusy: (value: boolean) => void; onError: (message: string) => void; onVerified: (hash: string) => Promise<void> }) {
  const { sendPayment, walletBalance } = usePollar();
  const [hash, setHash] = useState('');
  const [phase, setPhase] = useState<'ready' | 'signing' | 'verifying' | 'waiting'>('ready');
  const [destinationTrustline, setDestinationTrustline] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const destination = routeDestination();
  const issuer = walletBalance.step === 'loaded' ? (walletBalance.data.balances.find(balance => balance.code === 'USDC' && balance.issuer && Number(balance.balance) > 0)?.issuer || walletBalance.data.balances.find(balance => balance.code === 'USDC' && balance.issuer)?.issuer) : undefined;
  useEffect(() => {
    if (!destination || !issuer) { setDestinationTrustline('loading'); return; }
    let cancelled = false;
    void fetch(`https://horizon-testnet.stellar.org/accounts/${encodeURIComponent(destination)}`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error('destination account unavailable')))
      .then((account: { balances?: Array<{ asset_code?: string; asset_issuer?: string }> }) => { if (!cancelled) setDestinationTrustline(account.balances?.some(balance => balance.asset_code === 'USDC' && balance.asset_issuer === issuer) ? 'ready' : 'missing'); })
      .catch(() => { if (!cancelled) setDestinationTrustline('missing'); });
    return () => { cancelled = true; };
  }, [destination, issuer]);
  const canSend = Boolean(destination && issuer && destinationTrustline === 'ready');

  function send() {
    if (!destination) { onError('Live route destination is not configured. Set VITE_ROUTE_SETTLEMENT_WALLET to a dedicated Stellar testnet wallet with a USDC trustline.'); return; }
    if (!issuer) { onError('USDC issuer is not available in the connected Pollar wallet. Load a USDC balance/trustline before sending.'); return; }
    if (destinationTrustline !== 'ready') { onError('The dashboard recipient does not have the matching USDC trustline yet. Enable the USDC trustline before sending.'); return; }
    setSendDialogOpen(true); setPhase('ready'); onError('');
  }

  async function confirmSend() {
    if (!issuer || !destination) return;
    onBusy(true); onError(''); setPhase('signing');
    try {
      const params: SendPaymentParams = { chain: 'STELLAR', destination, amount: route.quote.destinationAmount, asset: { type: 'credit_alphanum4', code: 'USDC', issuer } };
      const outcome = await sendPayment(params);
      if (outcome.status === 'error') throw new Error(outcome.message || outcome.details || 'Pollar could not submit the payment.');
      setHash(outcome.hash); setSendDialogOpen(false); setPhase('verifying');
      try { await onVerified(outcome.hash); setPhase('ready'); }
      catch { setPhase('waiting'); }
    } catch (e) { setPhase('ready'); onError((e as Error).message); }
    finally { onBusy(false); }
  }

  async function retryVerification() { if (!hash) return; onBusy(true); onError(''); setPhase('verifying'); try { await onVerified(hash); setPhase('ready'); } catch { setPhase('waiting'); } finally { onBusy(false); } }

  return <div className="lr-review lr-send-step">
    <div className="send-step-heading"><span className="send-step-number">03</span><div><h3>Send USDC on Stellar testnet</h3><p>After Pollar signs the transfer, Vesrune captures the hash and independently verifies it before crediting the route.</p></div></div>
    <dl className="summary-list"><div><dt>Amount</dt><dd>{route.quote.destinationAmount} USDC</dd></div><div><dt>Recipient</dt><dd className="mono">{destination || 'Operator destination not configured'}</dd></div><div><dt>Asset</dt><dd>{issuer ? 'USDC · issuer detected' : 'USDC · trustline not detected'}</dd></div></dl>
    {!canSend && <div className="notice"><ShieldCheck size={18}/><span>{!destination ? 'Live sending is disabled until the operator configures a dedicated recipient wallet.' : !issuer ? 'Live sending is disabled until the connected wallet exposes the USDC issuer.' : destinationTrustline === 'missing' ? 'Live sending is disabled because the dashboard recipient has no matching USDC trustline yet.' : 'Checking the dashboard recipient’s USDC trustline…'} The manual hash verifier remains available for rehearsals.</span></div>}
    {hash && <p className="fineprint mono">Submitted hash: {hash}</p>}
    {phase === 'waiting' && <p className="fineprint">The hash was captured, but Horizon has not returned final settlement yet. Retry verification without sending a second payment.</p>}
    <div className="action-row"><button className="button primary" disabled={busy || !canSend} onClick={send}>{phase === 'verifying' ? 'Verifying…' : 'Send USDC'}</button>{phase === 'waiting' && <button className="button secondary" disabled={busy} onClick={()=>void retryVerification()}>Retry verification</button>}</div>
    {sendDialogOpen && <div className="route-send-overlay" role="dialog" aria-modal="true" aria-labelledby="route-send-title"><div className="route-send-dialog"><div className="section-head"><div><span className="hero-label">ROUTE PAYMENT</span><h2 id="route-send-title">Review testnet transfer</h2></div><button className="icon-button" disabled={busy} aria-label="Close send dialog" onClick={()=>setSendDialogOpen(false)}>×</button></div><p className="fineprint">These route values are locked by the approved quote. Review them, then click Send USDC to open the Pollar signing flow.</p><label htmlFor="route-send-amount">Amount</label><input id="route-send-amount" value={`${route.quote.destinationAmount} USDC`} readOnly/><label htmlFor="route-send-destination">Recipient</label><input id="route-send-destination" className="mono" value={destination} readOnly/><label htmlFor="route-send-asset">Asset issuer</label><input id="route-send-asset" className="mono" value={issuer} readOnly/><div className="notice"><ShieldCheck size={18}/><span>This is a real Stellar testnet transfer. Pollar will ask you to authorize the transaction.</span></div><div className="action-row"><button className="button secondary" disabled={busy} onClick={()=>setSendDialogOpen(false)}>Cancel</button><button className="button primary" disabled={busy} onClick={()=>void confirmSend()}>{busy ? 'Waiting for authorization…' : 'Send USDC'}</button></div></div></div>}
  </div>;
}

export function LocalRoutes() {
  const [amount, setAmount] = useState('150000');
  const [purpose, setPurpose] = useState<RoutePurpose>('wallet');
  const [routes, setRoutes] = useState<LocalRoute[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState({ transactionHash: '' });
  const route = routes.find(r => r.id === selected);
  const valid = /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) >= 1500 && Number(amount) <= 1500000;
  const gross = valid ? Number(amount) : 0;
  const net = gross * .99 / 1500;
  async function create() {
    if (!valid) { setError('Enter ₦1,500–₦1,500,000 with at most two decimal places.'); return; }
    setBusy(true); setError(''); try { const quote = await api<LocalRoute['quote']>('/api/local-routes/quotes', { method: 'POST', body: JSON.stringify({ sourceAmount: amount, purpose }) }); const item = await api<LocalRoute>('/api/local-routes', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ quoteId: quote.id }) }); setRoutes(old => [item, ...old]); setSelected(item.id); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function advance(status: LocalRouteStatus, note: string) {
    if (!route) return;
    if (status === 'under_review' && Date.parse(route.quote.expiresAt) < Date.now()) { setError('This rehearsal quote expired. Create a new route.'); return; }
    setBusy(true); setError(''); try { const updated = status === 'under_review' ? await api<LocalRoute>(`/api/local-routes/${route.id}/evidence`, { method: 'POST', body: JSON.stringify({ reference: route.reference, expectedVersion: route.version }) }) : status === 'cancelled' ? await api<LocalRoute>(`/api/local-routes/${route.id}/cancel`, { method: 'POST', body: JSON.stringify({ expectedVersion: route.version }) }) : route; setRoutes(old => old.map(r => r.id === route.id ? updated : r)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function reviewRoute(decision: 'approve' | 'reject') {
    if (!route) return;
    setBusy(true); setError(''); try { const updated = await api<LocalRoute>(`/api/local-routes/${route.id}/review`, { method: 'POST', headers: { 'X-Sandbox-Role': 'operator' }, body: JSON.stringify({ decision, reason: decision === 'approve' ? 'Sandbox funding reference reviewed for the demo.' : 'Sandbox funding reference rejected in the demo.', expectedVersion: route.version }) }); setRoutes(old => old.map(r => r.id === route.id ? updated : r)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function submitSettlement() {
    if (!route) return;
    if (!proof.transactionHash.trim()) { setError('Enter the Stellar testnet transaction hash.'); return; }
    setBusy(true); setError(''); try { const updated = await api<LocalRoute>(`/api/local-routes/${route.id}/settlement`, { method: 'POST', body: JSON.stringify({ transactionHash: proof.transactionHash.trim(), expectedVersion: route.version }) }); setRoutes(old => old.map(r => r.id === route.id ? updated : r)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function verifyCapturedHash(transactionHash: string) {
    if (!route) return;
    const updated = await api<LocalRoute>(`/api/local-routes/${route.id}/settlement`, { method: 'POST', body: JSON.stringify({ transactionHash, expectedVersion: route.version }) });
    setRoutes(old => old.map(r => r.id === route.id ? updated : r));
  }
  async function simulatePayout() {
    if (!route) return;
    setBusy(true); setError(''); try { const updated = await api<LocalRoute>(`/api/local-routes/${route.id}/simulate-payout`, { method: 'POST', body: JSON.stringify({ expectedVersion: route.version }) }); setRoutes(old => old.map(r => r.id === route.id ? updated : r)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="local-routes">
    <div className="page-heading"><div><h1>Local money. Wider possibilities.</h1><p>A considered path from your bank to your work account.</p></div><span className="badge lavender">Local Routes · Sandbox</span></div>
    <div className="lr-hero"><div><span className="lr-eyebrow">YOUR NEXT MOVE STARTS HERE</span><h2>From naira to<br/><em>what comes next.</em></h2><p>Bring funds into your wallet, prepare a deposit for Earn, or rehearse a cross-border handoff.</p></div><div className="lr-map" aria-label="Nigeria to Pollar to Bolivia"><span><Landmark/>NGN<small>Nigeria · sandbox</small></span><ArrowRight/><span><Wallet/>USDC<small>Pollar · testnet target</small></span><ArrowRight/><span><Globe2/>BOB<small>Bolivia · simulated</small></span></div></div>
    <div className="notice"><ShieldCheck size={18}/><span>Interactive sandbox rehearsal. The route and evidence reference are sent to Vesrune's backend; no bank collection or wallet transfer occurs. Session-only history; refreshing clears it. Rates are illustrative.</span></div>
    <div className="lr-grid"><section className="panel"><div className="section-head"><h2>Build your route</h2><span className="badge">01 / Funding</span></div>
      <form onSubmit={e=>{e.preventDefault();create();}}>
        <label htmlFor="lr-corridor">Funding method</label><select id="lr-corridor" disabled><option>Nigeria · NGN bank transfer · sandbox</option></select>
        <label htmlFor="lr-amount">You add · NGN</label><input id="lr-amount" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} aria-describedby="lr-limits"/><p id="lr-limits" className="field-hint">₦1,500 minimum · ₦1,500,000 maximum</p>
        <label htmlFor="lr-purpose">Then what?</label><select id="lr-purpose" value={purpose} onChange={e=>setPurpose(e.target.value as RoutePurpose)}>{Object.entries(purposes).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
        <dl className="summary-list"><div><dt>Illustrative rate</dt><dd>₦1,500 / USDC</dd></div><div><dt>Sandbox fee · 1%</dt><dd>₦{(gross*.01).toLocaleString(undefined,{minimumFractionDigits:2})}</dd></div><div><dt>Quote validity</dt><dd>10 minutes</dd></div></dl>
        <div className="lr-receive"><span>Estimated wallet credit</span><strong>{net.toFixed(2)} <small>USDC</small></strong><p>Capital, never counted as realized earnings.</p></div>
        <p className="fineprint">{purpose === 'earn' ? 'Funding does not deposit into a pool. Earn requires a separate approval after verified settlement.' : purpose === 'bolivia' ? 'Pollar handles the Bolivia leg. Our demo will simulate its final BOB payout after verified testnet settlement.' : 'A verified settlement would become idle capital in your wallet. No wallet is credited in this rehearsal.'}</p>
        <button className="button primary full" type="submit" disabled={busy}>{busy ? 'Creating route…' : 'Create sandbox route'} <ArrowRight size={17}/></button>
      </form>
    </section><section className="panel lr-detail" aria-live="polite"><div className="section-head"><h2>Follow the handoff</h2><span className="badge mint">Proof before credit</span></div>
      {!route ? <div className="lr-empty"><Globe2 size={40}/><h3>One route. Every step visible.</h3><p>Create a rehearsal to explore funding references, operator review, and the testnet settlement boundary.</p><ol><li>Local funding instructions</li><li>Evidence reviewed by an operator</li><li>Verified testnet USDC settlement</li><li>Your chosen next move</li></ol></div> : <>
        <div className="lr-reference"><small>DEMO REFERENCE · DO NOT SEND MONEY</small><strong>{route.reference}</strong><span>{labels[route.status]}</span></div>
        <dl className="summary-list"><div><dt>Destination intent</dt><dd>{purposes[route.quote.purpose]}</dd></div><div><dt>Quoted USDC</dt><dd>{route.quote.destinationAmount}</dd></div><div><dt>Transaction proof</dt><dd>Not submitted</dd></div></dl>
        <ol className="lr-timeline">{route.events.map((event,index)=><li key={index}><Check size={15}/><div><strong>{labels[event.status]}</strong><p>{event.note}</p></div></li>)}</ol>
        {route.status==='awaiting_funding' && <><p className="fineprint">In the sandbox, use this reference as evidence. There is no real receiving bank account. Do not upload bank statements or personal information.</p><button className="button primary full" disabled={busy} onClick={()=>void advance('under_review','Sandbox funding reference submitted; no funds confirmed.')}>{busy ? 'Submitting…' : 'Submit funding evidence'}</button><button className="button secondary full" disabled={busy} onClick={()=>void advance('cancelled','Rehearsal cancelled before funding.')}>Cancel rehearsal</button></>}
        {route.status==='under_review' && <div className="lr-review"><h3>Operator role · sandbox review</h3><p>Review the funding reference, then move the route to the testnet proof step.</p><div className="action-row"><button className="button primary" disabled={busy} onClick={()=>void reviewRoute('approve')}>Approve route</button><button className="button secondary" disabled={busy} onClick={()=>void reviewRoute('reject')}>Reject</button></div></div>}
        {route.status==='awaiting_settlement' && <>{import.meta.env.VITE_POLLAR_API_KEY ? <LiveRoutePayment route={route} busy={busy} onBusy={setBusy} onError={setError} onVerified={verifyCapturedHash}/> : <form className="lr-proof-form" onSubmit={e=>{e.preventDefault();void submitSettlement();}}><div className="notice"><ShieldCheck size={18}/><span>Paste the transaction hash from a real Stellar testnet USDC transfer. Vesrune will look up the recipient, issuer, amount, network, and finality on Horizon before settlement.</span></div><label htmlFor="lr-hash">Stellar transaction hash</label><input id="lr-hash" value={proof.transactionHash} onChange={e=>setProof({transactionHash:e.target.value})} placeholder="Paste the testnet transaction hash" autoComplete="off" required/><p className="fineprint">The backend compares the payment to this route’s quoted {route.quote.destinationAmount} USDC and server-bound destination wallet. No client-supplied amount or recipient is trusted.</p><button className="button primary full" disabled={busy}>{busy ? 'Checking testnet proof…' : 'Verify testnet settlement'}</button></form>}</>}
        {route.status==='settled' && <div className="lr-review"><h3>Testnet settlement verified</h3><p>The backend matched the confirmed payment. The final Bolivian payout remains a Pollar-side handoff simulated for this demo.</p><button className="button primary full" disabled={busy} onClick={()=>void simulatePayout()}>Simulate BOB payout</button></div>}
        {route.status==='payout_simulated' && <div className="notice"><Check size={18}/><span>BOB payout simulated. Pollar owns the Bolivian ramp; no BOB payment was sent by Vesrune.</span></div>}
      </>}
      {error && <p className="error" role="alert">{error}</p>}
    </section></div>
    <section className="panel lr-history"><div className="section-head"><h2>Route journal</h2><span className="badge">This session only</span></div>{routes.length ? routes.map(r=><button key={r.id} className="lr-history-row" aria-pressed={selected===r.id} onClick={()=>{setSelected(r.id);setError('');}}><span><strong>{r.reference}</strong><small>{purposes[r.quote.purpose]} · Nigeria</small></span><span>{Number(r.quote.sourceAmount).toLocaleString()} NGN</span><span className="badge">{labels[r.status]}</span></button>) : <p className="muted">Your route receipts will appear here. Nothing has been sent.</p>}</section>
    <p className="fineprint lr-bottom">African corridor designed by Vesrune · Pollar wallet and settlement handoff is testnet-ready but live execution remains unverified · Bolivia payout simulated. Local cash-out and additional corridors are not enabled.</p>
  </section>;
}
