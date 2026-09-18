/** Versioned frontend handoff boundary. Preview-only commands must NEVER reach a live API. */
export const CONTRACT_VERSION = 1;
/** Integer asset units, 7 decimals. Number is bounded to MAX_SAFE_INTEGER in the preview.
 * Live JSON uses canonical decimal strings; Luna must supply conversion at the gateway. */
export type Units = number;
export type TaskStatus = 'requested' | 'approved' | 'delivered' | 'paid' | 'cancelled';
export type ProviderId = 'fieldnote' | 'lingua' | 'outline';
export interface WorkTask {
  id: string; title: string; brief: string; provider: ProviderId; amount: Units;
  status: TaskStatus; createdAt: string; approvedAt?: string; paidAt?: string;
  delivery?: string;
}
export interface Receipt {
  id: string; kind: 'deposit' | 'withdraw' | 'harvest' | 'reserve' | 'release' | 'payment' | 'task' | 'policy';
  title: string; amount: Units; createdAt: string; taskId?: string;
  provenance: 'local-preview';
}
export interface Policy { taskCap: Units; dailyCap: Units; paused: boolean; providers: ProviderId[] }
export interface Snapshot {
  version: 1; revision: number; mode: 'preview'; connected: boolean; workspace: string;
  principal: Units; vaultValue: Units; idleCapital: Units; realized: Units; reserved: Units;
  lifetimeRealized: Units; lifetimeSpent: Units; poolAvailable: boolean;
  policy: Policy; tasks: WorkTask[]; receipts: Receipt[]; applied: string[];
}
export type Command =
  | { type: 'deposit' | 'withdraw' | 'harvest'; amount: Units }
  | { type: 'createTask'; title: string; brief: string; provider: ProviderId; amount: Units }
  | { type: 'approve' | 'cancel' | 'pay' | 'previewDeliver'; taskId: string }
  | { type: 'policy'; policy: Policy }
  | { type: 'workspace'; name: string }
  | { type: 'connect'; connected: boolean }
  | { type: 'previewPool'; available: boolean };
export interface CommandEnvelope { id: string; expectedRevision: number; command: Command }
export interface WorkspaceGateway {
  read(): Promise<Snapshot>;
  execute(envelope: CommandEnvelope): Promise<Snapshot>;
  /** Local preview only. Not part of the backend API. */
  reset(empty?: boolean): Promise<Snapshot>;
}
