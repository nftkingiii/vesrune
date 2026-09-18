/** Proposed v1 backend wire contract. Luna implements this, Astra maps it into the UI later.
 * Never put secrets, signed payloads, or private keys in general workspace snapshots. */
export type DecimalAmount = string; // canonical nonnegative decimal, <=7 fractional digits; no exponent
export type Network = 'stellar-testnet';
export type OperationState = 'awaiting_signature' | 'submitted' | 'pending' | 'confirmed' | 'failed' | 'rejected' | 'expired' | 'reconciling';
export interface AssetRef { code: string; issuer: string; decimals: 7; network: Network }
export interface Money { amount: DecimalAmount; asset: AssetRef }
export interface Operation {
  id: string; kind: 'deposit' | 'withdraw' | 'harvest' | 'payment'; status: OperationState;
  amount: Money; createdAt: string; updatedAt: string; taskId?: string;
  transactionHash?: string; confirmedLedger?: number; explorerUrl?: string;
  errorCode?: string; publicMessage?: string;
}
export interface Quote {
  id: string; kind: Operation['kind']; amount: Money; expiresAt: string;
  accountRevision: number; destination: string; feeXlm: DecimalAmount;
  providerId?: string; poolId?: string; taskId?: string;
  minimumReceived?: DecimalAmount; warnings: string[];
}
export interface LiveTask {
  id: string; title: string; brief: string; providerId: string; budget: Money;
  status: 'requested' | 'approved' | 'running' | 'delivered' | 'payment_pending' | 'paid' | 'failed' | 'cancelled' | 'disputed';
  createdAt: string; approvedAt?: string; paidAt?: string;
  delivery?: { id: string; text: string; sha256: string; createdAt: string; references: string[] };
  operationId?: string; failureCode?: string;
}
export interface LiveSnapshot {
  contractVersion: 1; mode: 'testnet'; network: Network; revision: number;
  workspace: { id: string; name: string };
  wallet: { address: string; type: string; earnSupported: boolean } | null;
  balances: {
    capitalBasis: Money; positionValue: Money; idleCapital: Money;
    estimatedGain: Money; realizedEarnings: Money; reserved: Money; available: Money;
    lifetimeRealized: Money; lifetimeSpent: Money;
    reconciliation: 'fresh' | 'stale' | 'blocked'; observedLedger: number | null; observedAt: string | null;
  };
  policy: { revision: number; taskCap: Money; dailyCap: Money; paused: boolean; allowedProviderIds: string[] };
  capabilities: { earn: boolean; harvest: boolean; taskPayment: boolean; reasonCodes: string[] };
  tasks: LiveTask[]; operations: Operation[];
}
export interface ApiError { error: { code: string; message: string; retryable: boolean; requestId: string; fieldErrors?: Record<string,string> } }
