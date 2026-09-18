import type { LocalQuote, SettlementProof } from '../local-routes.js';

type SettlementConfig = { horizonUrl: string; assetCode: string; assetIssuer?: string; destinationWallet: string };

function sameAmount(left: unknown, right: string) {
  return typeof left === 'string' && Number.isFinite(Number(left)) && Number(left).toFixed(7) === Number(right).toFixed(7);
}

export function makeStellarSettlementVerifier(config: SettlementConfig) {
  return async function verify(proof: Pick<SettlementProof, 'transactionHash'>, quote: LocalQuote) {
    if (!/^[a-fA-F0-9]{64}$/.test(proof.transactionHash) || !/^G[A-Z2-7]{55}$/.test(config.destinationWallet) || !config.assetIssuer) return false;
    try {
      const base = config.horizonUrl.replace(/\/$/, '');
      const txResponse = await fetch(`${base}/transactions/${encodeURIComponent(proof.transactionHash)}`, { signal: AbortSignal.timeout(8_000) });
      if (!txResponse.ok) return false;
      const tx = await txResponse.json() as any;
      if (tx.successful !== true || !tx.ledger) return false;
      const opsResponse = await fetch(`${base}/transactions/${encodeURIComponent(proof.transactionHash)}/operations?limit=200`, { signal: AbortSignal.timeout(8_000) });
      if (!opsResponse.ok) return false;
      const operations = await opsResponse.json() as any;
      return Array.isArray(operations?._embedded?.records) && operations._embedded.records.some((op: any) => op.type === 'payment' && op.to === config.destinationWallet && op.asset_code === config.assetCode && op.asset_issuer === config.assetIssuer && sameAmount(op.amount, quote.destinationAmount));
    } catch { return false; }
  };
}
