import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const extras = readFileSync(new URL('../src/components/GuExtras.tsx', import.meta.url), 'utf8');

test('GU images preserve full clothing photo without cover-cropping in the final responsive styles', () => {
  const finalRules = css.slice(css.lastIndexOf('/* GU v3.0 full release:'));
  assert.match(finalRules, /\.product-photo,\s*\.gu-calendar-photo\s*\{[^}]*object-fit:\s*contain/s);
  assert.match(finalRules, /\.gu-v3-uploader \.gu-v3-tile \.product-photo,[\s\S]*?object-fit:\s*contain/);
  assert.match(finalRules, /\.gu-v3-uploader \.gu-v3-tile\s*\{[^}]*aspect-ratio:\s*3\s*\/\s*4/s);
});

test('GU photo gallery is responsive and fallback uses same size class as calendar image', () => {
  const finalRules = css.slice(css.lastIndexOf('/* GU v3.0 full release:'));
  assert.match(finalRules, /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(/);
  assert.match(finalRules, /@media\s*\(max-width:\s*600px\)/);
  assert.match(extras, /className=\{fallbackClassName\}/);
  assert.match(extras, /decoding="async"/);
});
