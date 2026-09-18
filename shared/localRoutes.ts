/** Route amounts are decimal strings. Never count incoming capital as earnings. */
export type RoutePurpose = 'wallet' | 'earn' | 'bolivia';
export type LocalRouteStatus = 'awaiting_funding' | 'under_review' | 'awaiting_settlement' | 'settled' | 'payout_simulated' | 'rejected' | 'cancelled' | 'refund_required';
export interface LocalQuote {
  id: string; sourceAmount: string; sourceCurrency: 'NGN'; destinationAmount: string;
  destinationAsset: 'USDC'; feeAmount: string; rate: string; expiresAt: string;
  purpose: RoutePurpose; provenance: 'sandbox'; network: 'testnet';
}
export interface LocalRoute {
  id: string; quote: LocalQuote; reference: string; status: LocalRouteStatus;
  version: number; createdAt: string; transactionHash?: string;
  events: { status: LocalRouteStatus; at: string; note: string }[];
}
