import { AppError } from './errors.js';
import { parseAmount } from './decimal.js';
export type Policy={revision:number;taskCap:string;dailyCap:string;paused:boolean;allowedProviderIds:string[]};
export function checkPolicy(p:Policy, amount:string, dailyCommitted:string, provider:string){ if(p.paused) throw new AppError('POLICY_PAUSED','Spending is paused'); if(!p.allowedProviderIds.includes(provider)) throw new AppError('PROVIDER_BLOCKED','Provider is not allowed'); if(parseAmount(amount)>parseAmount(p.taskCap)) throw new AppError('TASK_CAP','Task exceeds the per-task cap'); if(parseAmount(dailyCommitted)+parseAmount(amount)>parseAmount(p.dailyCap)) throw new AppError('DAILY_CAP','Task exceeds the daily cap'); }
