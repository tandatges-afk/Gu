/** Parameterized query compiler for GU's Firestore-shaped PostgreSQL store.
 * Field *names* are validated identifiers and emitted as fixed SQL expressions
 * so the PostgreSQL planner can use expression indexes; all field *values*
 * are bind parameters. Pure module, usable in Node tests without a DB.
 */
export type GuCondition={field:string;op:string;value:unknown};
export type GuOrdering={field:string;dir:'asc'|'desc'};
export type GuAfter={id:string;values:unknown[]};
export type GuQuerySpec={
  name:string;conditions:GuCondition[];ordering:GuOrdering[];
  cap?:number;bounds:Record<string,unknown>;after?:GuAfter;
};
export type CompiledQuery={sql:string;params:unknown[]};
const validField=/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;
export function pgFieldSql(field:string):string{
  if(field==='__name__')return 'id';
  if(!validField.test(field))throw Error('Invalid query key');
  const path=field.split('.');
  if(path.length===1)return `(data->>'${path[0]}')`;
  return `(data #>> '{${path.join(',')}}')`;
}
function boundedCap(cap?:number){
 if(cap!==undefined&&(!Number.isInteger(cap)||cap<0||cap>10000))throw Error('Invalid page size');
 return cap;
}
export function compileGuQuery(spec:GuQuerySpec,mode:'rows'|'count'='rows'):CompiledQuery{
  const cap=boundedCap(spec.cap);
  const params:unknown[]=[spec.name];
  const bind=(v:unknown)=>{params.push(v);return '$'+params.length;};
  let filter='collection=$1';
  for(const c of spec.conditions){
    if(!['==','!=','>','>=','<','<=','in','array-contains'].includes(c.op))throw Error('Unsupported condition '+c.op);
    const field=pgFieldSql(c.field);
    if(c.op==='array-contains'){
      if(c.field==='__name__'||c.field.includes('.'))throw Error('Invalid JSONB array key');
      filter+=` AND (data->'${c.field}') @> ${bind(JSON.stringify([c.value]))}::jsonb`;
    }else if(c.op==='in'){
      if(!Array.isArray(c.value)||c.value.length===0)throw Error('Invalid in query');
      filter+=` AND ${field} = ANY(${bind(c.value.map(String))}::text[])`;
    }else{
      filter+=` AND ${field} ${c.op==='=='?'=':c.op==='!='?'<>':c.op} ${bind(String(c.value))}`;
    }
  }
  const order=spec.ordering.length?spec.ordering:[{field:'__name__',dir:'asc' as const}];
  const first=pgFieldSql(order[0].field);
  for(const [key,operator] of [['startAt','>='],['endAt','<='],['endBefore','<']] as const){
    if(spec.bounds[key]!==undefined)filter+=` AND ${first} ${operator} ${bind(String(spec.bounds[key]))}`;
  }
  const stable=order.some(o=>o.field==='__name__')?order:[...order,{field:'__name__',dir:'asc' as const}];
  if(spec.after){
    const cursor=spec.after;
    const values=stable.map((o,i)=>o.field==='__name__'?(cursor.id||undefined):cursor.values[i]);
    // `startAfter('name','id')` from the visual index supplies both fields.
    // Snapshot cursors also have a deterministic ID tie-breaker.
    if(cursor.id || cursor.values.length){
      const conditions:string[]=[];
      for(let i=0;i<stable.length;i++){
        if(values[i]===undefined||values[i]===null)break;
        const clauses:string[]=[];
        for(let j=0;j<i;j++)clauses.push(`${pgFieldSql(stable[j].field)} = ${bind(String(values[j]))}`);
        clauses.push(`${pgFieldSql(stable[i].field)} ${stable[i].dir==='desc'?'<':'>'} ${bind(String(values[i]))}`);
        conditions.push('('+clauses.join(' AND ')+')');
      }
      if(conditions.length)filter+=' AND ('+conditions.join(' OR ')+')';
    }
  }
  if(mode==='count'){
    // For the dashboard count queries this never materializes the JSONB payload.
    // Firestore count() on a limited query counts at most the requested limit.
    const base=`SELECT COUNT(*)::integer AS count FROM gu_documents WHERE ${filter}`;
    return {sql:cap===undefined?base:`SELECT LEAST(count, ${bind(cap)}::integer)::integer AS count FROM (${base}) AS gu_count`,params};
  }
  let sql=`SELECT id,data FROM gu_documents WHERE ${filter}`;
  sql+=' ORDER BY '+stable.map(o=>`${pgFieldSql(o.field)} ${o.dir==='desc'?'DESC':'ASC'} NULLS LAST`).join(', ');
  if(cap!==undefined)sql+=` LIMIT ${bind(cap)}`;
  return {sql,params};
}
