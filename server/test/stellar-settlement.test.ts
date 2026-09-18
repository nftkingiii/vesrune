import { describe, expect, it, vi } from 'vitest';
import { makeStellarSettlementVerifier } from '../src/stellar/settlement.js';

const issuer = `G${'B'.repeat(55)}`;
const owner = `G${'A'.repeat(55)}`;
const quote = { destinationAmount: '0.99' } as any;

describe('Stellar settlement verifier', () => {
  it('requires a successful confirmed testnet payment matching the quote', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ successful: true, ledger: 123 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ _embedded: { records: [{ type: 'payment', to: owner, asset_code: 'USDC', asset_issuer: issuer, amount: '0.9900000' }] } })));
    vi.stubGlobal('fetch', fetchMock);
    const verify = makeStellarSettlementVerifier({ horizonUrl: 'https://horizon.test', assetCode: 'USDC', assetIssuer: issuer, destinationWallet: owner });
    await expect(verify({ transactionHash: 'a'.repeat(64) }, quote)).resolves.toBe(true);
    vi.unstubAllGlobals();
  });

  it('rejects an amount mismatch before calling Horizon', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const verify = makeStellarSettlementVerifier({ horizonUrl: 'https://horizon.test', assetCode: 'USDC', assetIssuer: issuer, destinationWallet: owner });
    await expect(verify({ transactionHash: 'b'.repeat(64) }, quote)).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
