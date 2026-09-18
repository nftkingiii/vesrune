import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PreviewGateway } from './gateway';
import { units } from './domain';
describe('Preview gateway boundaries',()=>{
  beforeEach(()=>{vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});});
  it('preserves all balances after simulated failure and permits retry',async()=>{
    const g=new PreviewGateway(),s=await g.read();
    const e={id:'failure-test',expectedRevision:s.revision,command:{type:'deposit' as const,amount:units('1')}};
    g.failNext();await expect(g.execute(e)).rejects.toThrow('Simulated provider failure');
    expect(await g.read()).toEqual(s);const next=await g.execute(e);expect(next.principal).toBe(s.principal+units('1'));
  });
  it('recovers corrupt stored JSON without exposing its content',async()=>{
    vi.stubGlobal('localStorage',{getItem:()=>'{bad-json',setItem:vi.fn()});const g=new PreviewGateway();expect(g.storageWarning).toContain('fresh example');expect((await g.read()).mode).toBe('preview');
  });
  it('continues in session when storage is denied',async()=>{
    vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{throw new Error('denied');}});const g=new PreviewGateway();const s=await g.read();await g.execute({id:'storage',expectedRevision:s.revision,command:{type:'workspace',name:'Session example'}});expect(g.storageWarning).toContain('only for this session');
  });
  it('returns isolated copies instead of a mutable internal ledger',async()=>{
    const g=new PreviewGateway();const s=await g.read();s.realized=0;expect((await g.read()).realized).not.toBe(0);
  });
});
