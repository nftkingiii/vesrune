import { describe, expect, it } from 'vitest';
import type { Command, Snapshot } from '../shared/contracts';
import { available, harvestable, seed, transition, units, validSnapshot } from './domain';
let sequence=0;
const run=(s:Snapshot,command:Command)=>transition(s,{id:`test-${++sequence}`,expectedRevision:s.revision,command});
describe('Exact amounts',()=>{
  it('accepts coherent seed and rejects corrupt nested storage',()=>{expect(validSnapshot(seed())).toBe(true);expect(validSnapshot({...seed(),tasks:[{id:'bad'}]})).toBe(false);expect(validSnapshot({...seed(),reserved:0})).toBe(false);});
  it('parses 7-decimal asset amounts without float multiplication',()=>{expect(units('0.0000001')).toBe(1);expect(units('3.50')).toBe(35_000_000);});
  it.each(['0','-1','1e3','NaN','0.00000001','1000001','Infinity','1.2.3'])('rejects %s',value=>expect(()=>units(value)).toThrow());
});
describe('Capital and earnings separation',()=>{
  it('deposits capital without creating spendable earnings',()=>{const s=seed();const n=run(s,{type:'deposit',amount:units('50')});expect(n.principal).toBe(s.principal+units('50'));expect(available(n)).toBe(available(s));expect(harvestable(n)).toBe(harvestable(s));});
  it('withdraws capital only to idle capital',()=>{const s=seed();const n=run(s,{type:'withdraw',amount:units('50')});expect(n.idleCapital).toBe(s.idleCapital+units('50'));expect(n.realized).toBe(s.realized);});
  it('harvests only positive earnings',()=>{const s=seed();const n=run(s,{type:'harvest',amount:harvestable(s)});expect(n.principal).toBe(s.principal);expect(n.vaultValue).toBe(s.principal);expect(harvestable(n)).toBe(0);expect(n.realized).toBe(s.realized+units('24.80'));});
  it('rejects principal harvesting',()=>expect(()=>run(seed(),{type:'harvest',amount:units('25')})).toThrow());
  it('blocks harvest and withdrawal when position is below basis',()=>{const s=seed();s.vaultValue=s.principal-units('10');expect(harvestable(s)).toBe(0);expect(()=>run(s,{type:'harvest',amount:1})).toThrow();expect(()=>run(s,{type:'withdraw',amount:1})).toThrow();});
  it.each(['deposit','withdraw','harvest'] as const)('blocks unavailable pool %s',type=>{const s=seed();s.poolAvailable=false;expect(()=>run(s,{type,amount:1})).toThrow('Pool unavailable');});
});
describe('Approval and settlement lifecycle',()=>{
  it('reserves, delivers, pays once without touching principal',()=>{const s=seed();let n=run(s,{type:'approve',taskId:'task-101'});expect(n.reserved).toBe(s.reserved+units('3.5'));expect(n.realized).toBe(s.realized);n=run(n,{type:'previewDeliver',taskId:'task-101'});n=run(n,{type:'pay',taskId:'task-101'});expect(n.principal).toBe(s.principal);expect(n.realized).toBe(s.realized-units('3.5'));expect(n.reserved).toBe(s.reserved);expect(()=>run(n,{type:'pay',taskId:'task-101'})).toThrow();});
  it('never pays an undelivered task',()=>expect(()=>run(seed(),{type:'pay',taskId:'task-102'})).toThrow());
  it('returns reservations after cancellation',()=>{const s=seed();const n=run(s,{type:'cancel',taskId:'task-102'});expect(n.reserved).toBe(0);expect(n.realized).toBe(s.realized);expect(()=>run(n,{type:'cancel',taskId:'task-102'})).toThrow();});
  it('cannot spend capital when earnings are empty',()=>{let s=seed(true);s=run(s,{type:'createTask',title:'Research task',brief:'Return a sourced research brief',provider:'fieldnote',amount:units('1')});expect(()=>run(s,{type:'approve',taskId:s.tasks[0].id})).toThrow('Insufficient realized');});
  it('enforces task cap',()=>{const s=seed();s.policy.taskCap=units('1');expect(()=>run(s,{type:'approve',taskId:'task-101'})).toThrow('per-task');});
  it('enforces daily cap including open reservations',()=>{const s=seed();s.policy.dailyCap=units('10');expect(()=>run(s,{type:'approve',taskId:'task-101'})).toThrow('daily');});
  it('rechecks provider allowlist at payment',()=>{let s=run(seed(),{type:'previewDeliver',taskId:'task-102'});s=run(s,{type:'policy',policy:{...s.policy,providers:['fieldnote']}});expect(()=>run(s,{type:'pay',taskId:'task-102'})).toThrow('provider');});
  it('pause blocks approvals but not cancellation',()=>{const s=seed();s.policy.paused=true;expect(()=>run(s,{type:'approve',taskId:'task-101'})).toThrow('paused');expect(run(s,{type:'cancel',taskId:'task-102'}).reserved).toBe(0);});
  it('pause blocks payments',()=>{let s=run(seed(),{type:'previewDeliver',taskId:'task-102'});s.policy.paused=true;expect(()=>run(s,{type:'pay',taskId:'task-102'})).toThrow('paused');});
  it('disconnection blocks mutations',()=>{const s=seed();s.connected=false;expect(()=>run(s,{type:'approve',taskId:'task-101'})).toThrow('Connect');});
  it('rejects invalid policy and unknown providers',()=>{const s=seed();expect(()=>run(s,{type:'policy',policy:{...s.policy,taskCap:units('30')}})).toThrow();});
  it('rejects duplicate approval with a new key',()=>{const s=run(seed(),{type:'approve',taskId:'task-101'});expect(()=>run(s,{type:'approve',taskId:'task-101'})).toThrow();});
});
describe('Atomicity and concurrency',()=>{
  it('idempotently returns the original mutation result state',()=>{const s=seed();const e={id:'stable',expectedRevision:0,command:{type:'deposit' as const,amount:units('1')}};const n=transition(s,e);expect(transition(n,e)).toEqual(n);});
  it('rejects stale revisions',()=>expect(()=>transition(seed(),{id:'old',expectedRevision:9,command:{type:'connect',connected:false}})).toThrow('changed'));
  it('does not mutate source state on failure',()=>{const s=seed();const before=structuredClone(s);expect(()=>run(s,{type:'deposit',amount:units('500')})).toThrow();expect(s).toEqual(before);});
  it('maintains realized minus spent equality after harvest and payment',()=>{let s=seed();s=run(s,{type:'harvest',amount:units('2')});s=run(s,{type:'previewDeliver',taskId:'task-102'});s=run(s,{type:'pay',taskId:'task-102'});expect(s.lifetimeRealized-s.lifetimeSpent).toBe(s.realized);});
});
