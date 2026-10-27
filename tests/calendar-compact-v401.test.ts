import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css = readFileSync('src/app/globals.css', 'utf8');
const page = readFileSync('src/app/page.tsx', 'utf8');

test('v4.1 desktop slots are low-height, fill the width of each day column', () => {
  assert.match(css, /@media \(min-width:\s*851px\)[\s\S]*?\.calendar-grid \.calendar-cell\s*\{[^}]*max-width:\s*none[^}]*aspect-ratio:\s*auto/s);
  assert.match(css, /height:\s*62px/);
});

test('mobile day buttons remain square and at least 44px across', () => {
  assert.match(css, /grid-auto-columns:\s*80px/);
  assert.match(css, /grid-auto-columns:\s*74px/);
  assert.match(css, /\.gu-mobile-days-grid \.gu-calendar-mobile-cell\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/s);
});

test('compact calendar preserves order detail and quick create interaction', () => {
  assert.match(page, /onClick=\{\(\)=>matching\.length>1\?setCalendarMatches\(matching\):shown\?openDetail\(shown\):openBooking\(/);
  assert.match(page, /title=\{title\} aria-label=/);
});
