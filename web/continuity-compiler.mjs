/**
 * General exclusions over the existing v4 organisational dependency graph.
 * Pure model analysis: no authentication, authorization, provider check or proof.
 * v3 remains v3 and yields unknown for selected inventory records.
 *
 * A method requires ALL resources; alternative methods are OR choices. Known
 * routes need declared-ready, complete resources and declared-ready methods.
 * Unknown/incomplete declarations can establish possibility, never a route.
 * Planned methods establish neither. Least fixed points prevent a closed cycle
 * from manufacturing an independent seed. Excluded/unavailable resources cannot
 * seed or satisfy a route; another non-excluded alternative may still work.
 *
 * `basis` covers ALL potential alternatives in each target's dependency closure,
 * including unknown/planned methods. This intentionally causes conservative
 * review after an alternative changes even when the selected route is unchanged.
 * It excludes dates, checks, unrelated graph components and irrelevant exclusions.
 * Selected routes use stable minimum-depth choices, not a globally minimum set.
 */
import {validatePassport,PHONE_SCHEMA} from './extra-model.mjs';

const INV=/^item_[a-z0-9-]{8,40}$/;
const RES=/^resource_[a-z0-9-]{8,40}$/;
const fail=()=>{throw new Error('INVALID_CONTINUITY_ANALYSIS');};
const sorted=values=>[...values].sort();
const byId=(a,b)=>a.id<b.id?-1:a.id>b.id?1:0;

function plainData(value){
  if(!value||Object.getPrototypeOf(value)!==Object.prototype)fail();
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(Reflect.ownKeys(descriptors).some(k=>typeof k!=='string'||!Object.hasOwn(descriptors[k],'value')))fail();
  return value;
}
function selectedIds(value,max,pattern,allowed){
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>max)fail();
  const keys=Reflect.ownKeys(value),descriptors=Object.getOwnPropertyDescriptors(value);
  if(keys.length!==value.length+1||keys.some(k=>typeof k!=='string'||k!=='length'&&!/^(0|[1-9]\d*)$/.test(k))||keys.some(k=>!Object.hasOwn(descriptors[k],'value')))fail();
  if(value.some(id=>typeof id!=='string'||!pattern.test(id)||!allowed.has(id))||new Set(value).size!==value.length)fail();
  return sorted(value);
}

/**
 * compileContinuity(passport,{targetInventoryIds=[],excludedResourceIds=[]}={})
 * The explicit target list defaults to none; it does not silently select a plan.
 * Unknown/blocked results carry no route IDs. All returned values are fresh.
 */
export function compileContinuity(passport,options={}){
  plainData(passport); // Do not invoke a top-level schema accessor before validation.
  const p=validatePassport(passport),o=plainData(options);
  if(Reflect.ownKeys(o).some(k=>!['targetInventoryIds','excludedResourceIds'].includes(k)))fail();
  const targets=selectedIds(Object.hasOwn(o,'targetInventoryIds')?o.targetInventoryIds:[],5,INV,new Set(p.inventory.map(x=>x.id)));
  const resources=p.schema===PHONE_SCHEMA?p.continuity.resources:[];
  const methods=p.schema===PHONE_SCHEMA?p.continuity.methods:[];
  const excluded=selectedIds(Object.hasOwn(o,'excludedResourceIds')?o.excludedResourceIds:[],24,RES,new Set(resources.map(x=>x.id)));
  const excludedSet=new Set(excluded),byResource=new Map(resources.map(x=>[x.id,x])),byTarget=new Map();
  for(const m of [...methods].sort(byId)){
    if(!byTarget.has(m.targetId))byTarget.set(m.targetId,[]);
    byTarget.get(m.targetId).push(m);
  }
  const accountFor=new Map(resources.filter(x=>x.kind==='account').map(x=>[x.inventoryId,x.id]));
  const allResources=new Set(),allMethods=new Set();
  function closure(id){
    if(allResources.has(id))return;
    allResources.add(id);
    for(const m of byTarget.get(id)||[]){allMethods.add(m.id);for(const req of m.requires)closure(req);}
  }
  for(const target of targets)if(accountFor.has(target))closure(accountFor.get(target));

  const known=new Set(),possible=new Set(),depth=new Map(),choice=new Map();
  const allowed=r=>!excludedSet.has(r.id)&&r.readiness!=='unavailable';
  for(const r of resources){
    if(!allowed(r))continue;
    if(r.mode==='independent'&&r.readiness==='declared_ready'&&r.methodsComplete){known.add(r.id);depth.set(r.id,0);}
    if(r.mode==='independent'||r.mode==='unknown'||!r.methodsComplete)possible.add(r.id);
  }
  let changed=true;
  while(changed){
    changed=false;const add=[];
    for(const r of [...resources].sort(byId)){
      if(known.has(r.id)||!allowed(r)||r.readiness!=='declared_ready'||r.mode!=='methods'||!r.methodsComplete)continue;
      const candidates=(byTarget.get(r.id)||[]).filter(m=>m.readiness==='declared_ready'&&m.requires.every(id=>known.has(id)));
      if(candidates.length){
        candidates.sort((a,b)=>(1+Math.max(...a.requires.map(id=>depth.get(id))))-(1+Math.max(...b.requires.map(id=>depth.get(id))))||byId(a,b));
        const method=candidates[0];add.push([r.id,1+Math.max(...method.requires.map(id=>depth.get(id))),method]);
      }
    }
    for(const [id,level,method] of add){known.add(id);depth.set(id,level);choice.set(id,method);changed=true;}
  }
  changed=true;
  while(changed){
    changed=false;const add=[];
    for(const r of resources){
      if(possible.has(r.id)||!allowed(r)||r.mode!=='methods')continue;
      if((byTarget.get(r.id)||[]).some(m=>m.readiness!=='planned'&&m.requires.every(id=>possible.has(id))))add.push(r.id);
    }
    for(const id of add){possible.add(id);changed=true;}
  }

  const results=targets.map(inventoryId=>{
    const root=accountFor.get(inventoryId),base={inventoryId,status:'unknown',methodIds:[],resourceIds:[]};
    if(!root)return base;
    if(!known.has(root))return {...base,status:possible.has(root)?'unknown':'blocked'};
    const routeResources=new Set(),routeMethods=new Set();
    function walk(id){
      if(routeResources.has(id))return;
      routeResources.add(id);
      const method=choice.get(id);
      if(method){routeMethods.add(method.id);for(const req of sorted(method.requires))walk(req);}
    }
    walk(root);
    return {...base,status:'declared_route',methodIds:sorted(routeMethods),resourceIds:sorted(routeResources)};
  });
  const relevantInventory=new Set(targets);
  for(const id of allResources){const r=byResource.get(id);if(r.inventoryId!==null)relevantInventory.add(r.inventoryId);}
  const basis=JSON.stringify([
    'aeterna.continuity-analysis-basis.v1',p.schema,targets,
    p.inventory.filter(x=>relevantInventory.has(x.id)).sort(byId).map(x=>[x.id,x.service,x.access,x.recovery]),
    resources.filter(x=>allResources.has(x.id)).sort(byId).map(x=>[x.id,x.kind,x.inventoryId,x.readiness,x.mode,x.methodsComplete]),
    methods.filter(x=>allMethods.has(x.id)).sort(byId).map(x=>[x.id,x.targetId,x.purpose,x.readiness,sorted(x.requires)]),
    excluded.filter(id=>allResources.has(id))
  ]);
  return {schema:'aeterna.continuity-analysis.v1',excludedResourceIds:excluded,results,basis};
}
