import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const assignment=/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/;

/** Loads local development variables without overriding the process environment. */
export function loadLocalEnv(filePath=resolve(process.cwd(),'.env')){
  if(!existsSync(filePath)) return;
  for(const raw of readFileSync(filePath,'utf8').split(/\r?\n/)){
    const line=raw.trim();
    if(!line||line.startsWith('#')) continue;
    const match=line.match(assignment);
    const key=match?.[1]; const rawValue=match?.[2];
    if(!key||rawValue===undefined||process.env[key]!==undefined) continue;
    const value=rawValue.replace(/^(['"])(.*)\1$/,'$2');
    process.env[key]=value;
  }
}
