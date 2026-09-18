import { AppError } from './errors.js';
export const SCALE = 10_000_000n;
export function parseAmount(value: unknown): bigint {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,7})?$/.test(value)) throw new AppError('VALIDATION_ERROR','Amount must be a canonical decimal string with at most 7 decimals');
  const [whole='0', fraction=''] = value.split('.');
  const result = BigInt(whole)*SCALE + BigInt((fraction+'0000000').slice(0,7));
  if (result > 10_000_000_000_000_000n) throw new AppError('VALIDATION_ERROR','Amount exceeds limit');
  return result;
}
export function formatAmount(value: bigint): string { const w=value/SCALE; const f=(value%SCALE).toString().padStart(7,'0').replace(/0+$/,''); return f ? `${w}.${f}` : `${w}`; }
