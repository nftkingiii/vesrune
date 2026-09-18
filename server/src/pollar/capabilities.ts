export type PollarCapability={enabled:false;reasonCodes:string[];providerIds:string[]};
export function unavailablePollarCapability():PollarCapability{return {enabled:false,reasonCodes:['POLLAR_NOT_CONFIGURED','REAL_EXECUTION_UNVERIFIED'],providerIds:[]};}
