import {describe,expect,it} from 'vitest';
import {makeServer} from '../src/http.js';

describe('safe HTTP boundary',()=>{
  it('allows the configured frontend origin to read health responses',async()=>{
    const server=makeServer({allowedOrigins:['http://127.0.0.1:5173']});
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',()=>resolve()));
    const address=server.address();
    if(!address||typeof address==='string') throw new Error('server did not bind');
    try { const response=await fetch(`http://127.0.0.1:${address.port}/healthz`,{headers:{Origin:'http://127.0.0.1:5173'}}); expect(response.status).toBe(200); expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173'); expect(response.headers.get('access-control-allow-credentials')).toBe('true'); }
    finally { await new Promise<void>(resolve=>server.close(()=>resolve())); }
  });

  it('returns request ids and fail-closed readiness',async()=>{
    const server=makeServer();
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',()=>resolve()));
    const address=server.address();
    if(!address||typeof address==='string') throw new Error('server did not bind');
    try { const response=await fetch(`http://127.0.0.1:${address.port}/readyz`); const json=await response.json() as {capabilities:{enabled:boolean};requestId:string}; expect(response.status).toBe(503); expect(json.capabilities.enabled).toBe(false); expect(json.requestId).toBeTruthy(); expect(response.headers.get('x-content-type-options')).toBe('nosniff'); }
    finally { await new Promise<void>(resolve=>server.close(()=>resolve())); }
  });
});
