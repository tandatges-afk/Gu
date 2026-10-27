import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync('src/app/page.tsx','utf8');
const css=readFileSync('src/app/globals.css','utf8');

test('phone uses per-product rental cards rather than the sticky 890px desktop table',()=>{
  assert.match(page,/className="gu-mobile-calendar"/);
  assert.match(page,/className="calendar-scroll gu-calendar-desktop"/);
  assert.match(page,/calendarDays\.map\(day=>\{const tone=calendarDayTone\(day,today\)/);
  assert.match(page,/renderCalendarCell\(item,day,true\)/);
  assert.match(page,/calendarUi\.mobileTrack/);
  assert.match(css,/\.gu-calendar-desktop\s*\{\s*display:\s*none/);
  assert.match(css,/\.gu-mobile-calendar\s*\{\s*display:\s*grid/);
});

test('rental slots and product/gallery thumbnails use square 1:1 aspect ratio',()=>{
  assert.match(css,/\.gu-mobile-days-grid\s+\.gu-calendar-mobile-cell\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/s);
  assert.match(css,/\.gu-v3-uploader \.gu-v3-tile\.gu-v3-tile\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/s);
  assert.match(css,/\.gu-calendar-photo,\s*\.photo-fallback\.gu-calendar-photo\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/s);
});

test('mobile dashboard has one order-action pair, not two duplicate groups',()=>{
  assert.equal((page.match(/className="gu-mobile-quick-actions"/g)||[]).length,0);
  assert.ok(page.includes("Đặt lịch trước</button>"));
  assert.ok(page.includes("Tạo đơn · chụp ảnh giao</button>"));
});
