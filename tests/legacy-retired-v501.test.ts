import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const route=readFileSync('src/app/api/orders/route.ts','utf8');
test('legacy new rental creation is retired with 410',()=>{assert.match(route,/new ApiError\(410/);assert.doesNotMatch(route,/tx\.create/);});
