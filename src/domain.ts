import type { CommandEnvelope, ProviderId, Receipt, Snapshot, Units } from '../shared/contracts';
export const SCALE = 10_000_000;
export function units(value: string): Units {
  if (!/^\d+(\.\d{1,7})?$/.test(value.trim())) throw new Error('Enter a positive amount with at most 7 decimal places.');
  const [whole, decimals = ''] = value.trim().split('.');
  const result = Number(whole) * SCALE + Number(decimals.padEnd(7, '0'));
  if (!Number.isSafeInteger(result) || result <= 0 || result > 1_000_000 * SCALE) throw new Error('Amount must be greater than zero and no more than 1,000,000 USDC.');
  return result;
}
export const money = (value: Units) => (value / SCALE).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const decimal = (value: Units) => (value / SCALE).toFixed(7).replace(/\.?0+$/, '');
export const available = (s: Snapshot) => s.realized - s.reserved;
export const harvestable = (s: Snapshot) => Math.max(0, s.vaultValue - s.principal);
export const providers: { id: ProviderId; name: string; specialty: string; initials: string }[] = [
  { id: 'fieldnote', name: 'Fieldnote', specialty: 'Research & synthesis', initials: 'fn' },
  { id: 'lingua', name: 'Lingua', specialty: 'Translation & localization', initials: 'li' },
  { id: 'outline', name: 'Outline', specialty: 'Writing & review', initials: 'ou' },
];
export const providerName = (id: ProviderId) => providers.find(p => p.id === id)?.name ?? id;
/** Defensive validation of local fixtures; never a substitute for a server ledger. */
export function validSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false;
  const s = value as Snapshot;
  const bounded = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER;
  const timestamp = (n: unknown) => typeof n === 'string' && Number.isFinite(Date.parse(n));
  if (s.version !== 1 || s.mode !== 'preview' || typeof s.connected !== 'boolean' || typeof s.poolAvailable !== 'boolean' || typeof s.workspace !== 'string' || s.workspace.length > 50) return false;
  if (![s.revision,s.principal,s.vaultValue,s.idleCapital,s.realized,s.reserved,s.lifetimeRealized,s.lifetimeSpent].every(bounded)) return false;
  if (!s.policy || !bounded(s.policy.taskCap) || !bounded(s.policy.dailyCap) || s.policy.taskCap <= 0 || s.policy.taskCap > s.policy.dailyCap || typeof s.policy.paused !== 'boolean' || !Array.isArray(s.policy.providers) || !s.policy.providers.every(id => providers.some(p=>p.id===id))) return false;
  if (!Array.isArray(s.tasks) || !s.tasks.every(t=>t && typeof t.id==='string' && typeof t.title==='string' && typeof t.brief==='string' && bounded(t.amount) && t.amount>0 && providers.some(p=>p.id===t.provider) && ['requested','approved','delivered','paid','cancelled'].includes(t.status) && timestamp(t.createdAt) && (!t.delivery || typeof t.delivery==='string') && (!t.approvedAt || timestamp(t.approvedAt)) && (!t.paidAt || timestamp(t.paidAt)))) return false;
  if (new Set(s.tasks.map(t=>t.id)).size !== s.tasks.length) return false;
  if (!Array.isArray(s.receipts) || !s.receipts.every(r=>r && typeof r.id==='string' && typeof r.title==='string' && bounded(r.amount) && timestamp(r.createdAt) && r.provenance==='local-preview' && ['deposit','withdraw','harvest','reserve','release','payment','task','policy'].includes(r.kind))) return false;
  if (!Array.isArray(s.applied) || !s.applied.every(id=>typeof id==='string')) return false;
  return s.realized >= s.reserved && s.lifetimeRealized-s.lifetimeSpent===s.realized && s.tasks.filter(t=>t.status==='approved'||t.status==='delivered').reduce((a,t)=>a+t.amount,0)===s.reserved;
}
export function seed(empty = false): Snapshot {
  const now = new Date().toISOString();
  return {
    version: 1, revision: 0, mode: 'preview', workspace: 'Personal workspace', connected: true,
    principal: empty ? 0 : units('2500'), vaultValue: empty ? 0 : units('2524.80'),
    idleCapital: units('125'), realized: empty ? 0 : units('18.64'), reserved: empty ? 0 : units('2'),
    lifetimeRealized: empty ? 0 : units('26'), lifetimeSpent: empty ? 0 : units('7.36'), poolAvailable: true,
    policy: { taskCap: units('10'), dailyCap: units('25'), paused: false, providers: ['fieldnote', 'lingua', 'outline'] },
    tasks: empty ? [] : [
      { id: 'task-101', title: 'A clearer picture of the market', brief: 'Compare three public project pages. Summarize their product positioning and cite every source.', provider: 'fieldnote', amount: units('3.50'), status: 'requested', createdAt: now },
      { id: 'task-102', title: 'Make the launch speak French', brief: 'Translate the launch description into natural French. Preserve product and feature names.', provider: 'lingua', amount: units('2'), status: 'approved', createdAt: now, approvedAt: now },
      { id: 'task-103', title: 'A second pair of eyes', brief: 'Review the one-page product introduction for clarity and unsupported claims.', provider: 'outline', amount: units('7.36'), status: 'paid', createdAt: now, approvedAt: now, paidAt: now, delivery: 'Example review: lead with the user outcome, define realized earnings, and remove any promise of guaranteed returns.' },
    ],
    receipts: empty ? [] : [
      { id: 'receipt-003', kind: 'reserve', title: 'Budget reserved · Lingua', amount: units('2'), createdAt: now, taskId: 'task-102', provenance: 'local-preview' },
      { id: 'receipt-002', kind: 'payment', title: 'Work paid · Outline', amount: units('7.36'), createdAt: now, taskId: 'task-103', provenance: 'local-preview' },
      { id: 'receipt-001', kind: 'harvest', title: 'Earnings moved to work balance', amount: units('26'), createdAt: now, provenance: 'local-preview' },
    ], applied: [],
  };
}
function requireThat(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function validAmount(n: number) { requireThat(Number.isSafeInteger(n) && n > 0 && n <= 1_000_000 * SCALE, 'Invalid amount.'); }
export function dailyCommitted(s: Snapshot, now = new Date().toISOString()) {
  return s.tasks.filter(t => (t.status === 'paid' && t.paidAt?.slice(0,10) === now.slice(0,10)) || t.status === 'approved' || t.status === 'delivered').reduce((a,t) => a + t.amount, 0);
}
export function transition(previous: Snapshot, e: CommandEnvelope, now = new Date().toISOString()): Snapshot {
  if (previous.applied.includes(e.id)) return previous;
  requireThat(previous.revision === e.expectedRevision, 'This workspace changed. Review the refreshed balance and try again.');
  const s = structuredClone(previous), c = e.command;
  const add = (kind: Receipt['kind'], title: string, amount = 0, taskId?: string) => s.receipts.unshift({ id: `receipt-${e.id}`, kind, title, amount, taskId, createdAt: now, provenance: 'local-preview' });
  if (!['connect', 'workspace', 'previewPool'].includes(c.type)) requireThat(s.connected, 'Connect the preview account first.');
  if (c.type === 'deposit' || c.type === 'withdraw' || c.type === 'harvest') {
    validAmount(c.amount); requireThat(s.poolAvailable, 'Pool unavailable. No balance has changed.');
    if (c.type === 'deposit') {
      requireThat(c.amount <= s.idleCapital, 'Not enough idle capital.');
      s.idleCapital -= c.amount; s.principal += c.amount; s.vaultValue += c.amount;
      add('deposit', 'Capital added to the earn position', c.amount);
    } else if (c.type === 'withdraw') {
      requireThat(s.vaultValue >= s.principal, 'Position is below its capital basis. Reconciliation is required before withdrawing in this preview.');
      requireThat(c.amount <= s.principal, 'Amount exceeds deposited capital.');
      s.principal -= c.amount; s.vaultValue -= c.amount; s.idleCapital += c.amount;
      add('withdraw', 'Capital returned to the account', c.amount);
    } else {
      requireThat(c.amount <= harvestable(s), 'Only positive, available earnings can be harvested.');
      s.vaultValue -= c.amount; s.realized += c.amount; s.lifetimeRealized += c.amount;
      add('harvest', 'Earnings moved to work balance', c.amount);
    }
  } else if (c.type === 'createTask') {
    validAmount(c.amount);
    requireThat(c.title.trim().length >= 3 && c.title.trim().length <= 90, 'Use a task title between 3 and 90 characters.');
    requireThat(c.brief.trim().length >= 12 && c.brief.length <= 3000, 'Describe the expected result in 12–3,000 characters.');
    requireThat(providers.some(p => p.id === c.provider), 'Unknown provider.');
    s.tasks.unshift({ id: `task-${e.id}`, title: c.title.trim(), brief: c.brief.trim(), amount: c.amount, provider: c.provider, status: 'requested', createdAt: now });
    add('task', 'Task requested · approval required', c.amount, `task-${e.id}`);
  } else if ('taskId' in c) {
    const task = s.tasks.find(t => t.id === c.taskId); requireThat(task, 'Task not found.');
    if (c.type === 'approve' || c.type === 'pay') {
      requireThat(!s.policy.paused, 'Work spending is paused. Update your rules to continue.');
      requireThat(s.policy.providers.includes(task.provider), 'This provider is not allowed by your current rules.');
      requireThat(task.amount <= s.policy.taskCap, 'This task exceeds your per-task limit.');
    }
    if (c.type === 'approve') {
      requireThat(task.status === 'requested', 'Only requested tasks can be approved.');
      requireThat(task.amount <= available(s), 'Insufficient realized earnings. Capital cannot pay for work.');
      requireThat(dailyCommitted(s, now) + task.amount <= s.policy.dailyCap, 'This task would exceed your daily spending limit.');
      s.reserved += task.amount; task.status = 'approved'; task.approvedAt = now;
      add('reserve', `Budget reserved · ${providerName(task.provider)}`, task.amount, task.id);
    } else if (c.type === 'previewDeliver') {
      requireThat(task.status === 'approved', 'Only approved tasks can receive a delivery.');
      task.status = 'delivered'; task.delivery = `Illustrative delivery for “${task.title}”.\n\nThis is a local preview artifact, not output from an actual AI service. In the connected product, the provider returns the requested result, source references, and an artifact digest for your review.\n\nReview the work before accepting. Payment is still reserved, not sent.`;
      add('task', `Example delivery received · ${providerName(task.provider)}`, 0, task.id);
    } else if (c.type === 'pay') {
      requireThat(task.status === 'delivered', 'Review a delivered result before paying.');
      requireThat(dailyCommitted(s, now) <= s.policy.dailyCap, 'Current commitments exceed the daily limit.');
      requireThat(s.reserved >= task.amount && s.realized >= task.amount, 'Reserved balance is insufficient.');
      s.reserved -= task.amount; s.realized -= task.amount; s.lifetimeSpent += task.amount;
      task.status = 'paid'; task.paidAt = now; add('payment', `Work paid · ${providerName(task.provider)}`, task.amount, task.id);
    } else if (c.type === 'cancel') {
      requireThat(task.status !== 'paid' && task.status !== 'cancelled', 'This task is already closed.');
      if (task.status === 'approved' || task.status === 'delivered') s.reserved -= task.amount;
      task.status = 'cancelled'; add('release', 'Task cancelled · any reservation released', task.amount, task.id);
    }
  } else if (c.type === 'policy') {
    validAmount(c.policy.taskCap); validAmount(c.policy.dailyCap);
    requireThat(c.policy.taskCap <= c.policy.dailyCap, 'Per-task limit cannot exceed the daily limit.');
    requireThat(c.policy.providers.every(id => providers.some(p => p.id === id)), 'Unknown provider in policy.');
    s.policy = structuredClone(c.policy); add('policy', 'Spending rules updated');
  } else if (c.type === 'workspace') {
    requireThat(c.name.trim().length >= 2 && c.name.trim().length <= 50, 'Workspace name must be 2–50 characters.'); s.workspace = c.name.trim();
  } else if (c.type === 'connect') s.connected = c.connected;
  else if (c.type === 'previewPool') s.poolAvailable = c.available;
  requireThat(s.realized >= s.reserved && s.reserved >= 0 && s.principal >= 0 && s.vaultValue >= 0, 'Ledger invariant failed.');
  s.revision++; s.applied.push(e.id); return s;
}
