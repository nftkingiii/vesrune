import type { CommandEnvelope, Snapshot, WorkspaceGateway } from '../shared/contracts';
import { seed, transition, validSnapshot } from './domain';
const KEY = 'vesrune.preview.v1';
const delay = () => new Promise(resolve => setTimeout(resolve, 430));
/** UI-facing local adapter. Deliberately has no wallet SDK, server signing, or network payment. */
export class PreviewGateway implements WorkspaceGateway {
  private state: Snapshot = seed();
  private fail = false;
  storageWarning = '';
  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const value = JSON.parse(raw) as Snapshot;
        // Stored preview state is untrusted. Corrupt fixtures are discarded, never sent to a backend.
        if (!validSnapshot(value)) throw new Error('Invalid saved preview');
        this.state = value;
      }
    } catch { this.storageWarning = 'Saved preview could not be loaded. A fresh example is open.'; }
  }
  private persist() { try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { this.storageWarning = 'Browser storage is unavailable. Changes last only for this session.'; } }
  failNext() { this.fail = true; }
  async read() { await delay(); return structuredClone(this.state); }
  async execute(envelope: CommandEnvelope) {
    await delay();
    if (this.fail) { this.fail = false; throw new Error('Simulated provider failure. Nothing was submitted and no balance changed. Retry when ready.'); }
    this.state = transition(this.state, envelope); this.persist(); return structuredClone(this.state);
  }
  async reset(empty = false) { await delay(); this.state = seed(empty); this.persist(); return structuredClone(this.state); }
}
export const gateway = new PreviewGateway();
