import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach,describe,expect,it} from 'vitest';
import {loadLocalEnv} from '../src/env.js';

const created:string[]=[];
afterEach(()=>{for(const key of created) delete process.env[key]; created.length=0;});

describe('local environment loading',()=>{
  it('loads local values without overriding process values',()=>{
    const dir=mkdtempSync(join(tmpdir(),'vesrune-env-')); const file=join(dir,'.env');
    writeFileSync(file,'VESRUNE_ENV_TEST=loaded\nVESRUNE_ENV_EXISTING=file\n# ignored\n');
    process.env.VESRUNE_ENV_EXISTING='process'; created.push('VESRUNE_ENV_TEST');
    loadLocalEnv(file);
    expect(process.env.VESRUNE_ENV_TEST).toBe('loaded'); expect(process.env.VESRUNE_ENV_EXISTING).toBe('process');
    rmSync(dir,{recursive:true,force:true});
  });
});
