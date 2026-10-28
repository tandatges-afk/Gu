import 'server-only';
import { db } from './firebase-admin';
import type { Role } from './types';
import type { Transaction } from '@/lib/pg-firestore';
export type Actor = { uid: string; name: string; role: Role };
export function auditDoc(me:Actor, action:string, entityType:string, entityId:string, detail:string, createdAt = new Date().toISOString()) {
  const ref=db().collection('auditLogs').doc();
  return {ref, record:{actorUid:me.uid, actorName:me.name, actorRole:me.role, action, entityType, entityId, detail:detail.slice(0,400), createdAt}};
}
export function auditInTransaction(tx:Transaction,me:Actor,action:string,type:string,id:string,detail:string,now?:string) {
  const {ref, record}=auditDoc(me, action, type, id, detail, now);
  tx.create(ref,record);
}
export async function auditWrite(me:Actor,action:string,type:string,id:string,detail:string) {
  const {ref,record}=auditDoc(me,action,type,id,detail);
  await ref.create(record);
}
