import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css = readFileSync('src/app/globals.css', 'utf8');
const page = readFileSync('src/app/page.tsx', 'utf8');

test('desktop calendar buttons are compact squares rather than filling day columns', () => {
  assert.match(css, /\.calendar-grid \.calendar-cell\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1[^}]*max-width:\s*72px/s);
  assert.doesNotMatch(css, /\.calendar-grid \.calendar-cell\s*\{[^}]*width:\s*100%/s);
});

test('mobile day buttons remain square and at least 44px across', () => {
  assert.match(css, /grid-auto-columns:\s*80px/);
  assert.match(css, /grid-auto-columns:\s*74px/);
  assert.match(css, /\.gu-mobile-days-grid \.gu-calendar-mobile-cell\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/s);
});

test('compact calendar preserves order detail and quick create interaction', () => {
  assert.match(page, /onClick=\{\(\)=>shown\?openDetail\(shown\):openBooking\(/);
  assert.match(page, /title=\{title\} aria-label=/);
});
