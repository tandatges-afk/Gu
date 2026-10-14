import assert from 'node:assert/strict';
import {test} from 'node:test';
import {classifyTokenFailure} from '../src/lib/auth-errors.ts';
const asCode=(code:string)=>({code});
test('expired and revoked sessions give actionable 401',()=>{
  assert.equal(classifyTokenFailure(asCode('auth/id-token-expired')).status,401);
  assert.equal(classifyTokenFailure(asCode('auth/id-token-revoked')).status,401);
});
test('disabled user gets 403, not session expired',()=>{
  assert.equal(classifyTokenFailure(asCode('auth/user-disabled')).status,403);
});
test('server configuration or permissions failures do not masquerade as expired sessions',()=>{
  for(const code of ['auth/invalid-credential','auth/insufficient-permission']){
    assert.equal(classifyTokenFailure(asCode(code)).status,503);
  }
  assert.equal(classifyTokenFailure(new Error('Invalid PEM private key')).status,503);
});
test('diagnostics do not return raw error messages',()=>{
  const failure=classifyTokenFailure(new Error('private key is SECRET'));
  assert.equal(failure.message.includes('SECRET'),false);
});
