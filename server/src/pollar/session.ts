import { AppError } from '../errors.js';

export type VerifiedPollarSession = {
  subject: string;
  walletAddress?: string;
  walletType?: string;
  network?: string;
};

type SessionConfig = {
  verifyUrl?: string;
  serverApiKey?: string;
};

function readString(value: unknown, name: string) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) throw new AppError('UNAUTHENTICATED', `Pollar session response is missing ${name}`);
  return value;
}

export async function verifyPollarSession(headers: { authorization?: string; dpop?: string; nonce?: string }, config: SessionConfig): Promise<VerifiedPollarSession> {
  if (!config.verifyUrl) throw new AppError('UNAUTHENTICATED', 'Pollar session verification is not configured');
  if (!headers.authorization) throw new AppError('UNAUTHENTICATED', 'Pollar authorization is required');

  const forwarded: Record<string, string> = { Authorization: headers.authorization };
  if (headers.dpop) forwarded.DPoP = headers.dpop;
  if (headers.nonce) forwarded['DPoP-Nonce'] = headers.nonce;
  if (config.serverApiKey) forwarded['x-pollar-api-key'] = config.serverApiKey;

  let response: Response;
  try {
    response = await fetch(config.verifyUrl, { method: 'GET', headers: forwarded, signal: AbortSignal.timeout(8_000) });
  } catch {
    throw new AppError('UNAUTHENTICATED', 'Pollar session verification is unavailable');
  }
  if (!response.ok) throw new AppError('UNAUTHENTICATED', 'Pollar session was rejected');
  const payload = await response.json().catch(() => null) as any;
  const session = payload?.session ?? payload?.user ?? payload;
  const wallet = session?.wallet ?? payload?.wallet;
  return {
    subject: readString(session?.id ?? session?.subject ?? session?.userId, 'subject'),
    walletAddress: typeof wallet?.address === 'string' ? wallet.address : undefined,
    walletType: typeof wallet?.type === 'string' ? wallet.type : undefined,
    network: typeof wallet?.network === 'string' ? wallet.network : undefined,
  };
}
