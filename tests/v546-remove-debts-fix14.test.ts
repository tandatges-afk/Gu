import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
test('Debts feature is removed from UI, API and export surface',()=>{
 for(const name of ['src/app/api/debts/route.ts','src/components/GuDebts.tsx','src/lib/debts.ts','src/lib/debt-index.ts','scripts/migrate-debt-index.mjs']) assert.equal(existsSync(name),false,name);
 const page=read('src/app/page.tsx');
 assert.doesNotMatch(page,/GuDebts|DebtSummary|refreshDebts|debtSummary|setPage\('debts'\)|'debts'|Công nợ|CÔNG NỢ/);
 assert.doesNotMatch(page,/api<[^>]*>\('debts'\)/);
});
test('Order creation and all mutation routes do not update debtLedger',()=>{
 for(const name of ['src/app/api/orders/route.ts','src/app/api/orders/[id]/route.ts','src/app/api/v5/orders/route.ts','src/app/api/v5/orders/[id]/route.ts']){
  const text=read(name);assert.doesNotMatch(text,/syncDebtIndex|debtLedger/,name);
 }
});
test('Settlement, collateral and cash ledger are intact',()=>{
 const capture=read('src/components/GuOrderCapture.tsx');
 const returnFlow=read('src/components/GuReturnFlow.tsx');
 const orders=read('src/app/api/v5/orders/[id]/route.ts');
 assert.match(capture,/RETURN/);
 assert.match(returnFlow,/estimate\.remaining/);
 for(const symbol of ['cameraCollateralQuote','COLLATERAL_REFUND','cashDaily','paid:'])assert.ok(orders.includes(symbol),symbol);
 assert.match(orders,/APPROVE_RETURN/);
});
