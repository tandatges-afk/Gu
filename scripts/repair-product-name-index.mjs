/**
 * GU V5 PostgreSQL product-name migration (VPS, not Firebase).
 * Read-only by default. Only run --apply after verified DB backup and explicit approval.
 * Compatible with GU 5.4.6's `product-name-index-v1` gate and `gu_documents` schema.
 * No product rename/deletion. Migrates existing items and validates collisions.
 */
import pg from 'pg';

const args = process.argv.slice(2);
const applying = args.includes('--apply');
const confirmed = args.find(x => x.startsWith('--confirm-db='))?.slice('--confirm-db='.length);
const urlText = process.env.DATABASE_URL;
if (!urlText) throw new Error('Thiếu DATABASE_URL. Dùng --env-file=/etc/gu-v546/prod.env.');
const u = new URL(urlText);
const dbName = decodeURIComponent(u.pathname.replace(/^\//, ''));
if (!['gu_v546_stage', 'gu_v546_prod'].includes(dbName)) {
  throw new Error('Từ chối: script chỉ dành cho gu_v546_stage hoặc gu_v546_prod.');
}
if (applying && (confirmed !== dbName || process.env.GU_ACK_NAME_BACKUP !== 'yes')) {
  throw new Error('Chưa đủ điều kiện: cần GU_ACK_NAME_BACKUP=yes, --apply, --confirm-db=' + dbName);
}

// Keep identical to src/lib/product-name.ts and src/lib/product-search.ts
function normalizeProductName(value) {
  return value.normalize('NFKD').replace(/[đĐ]/g, 'd')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('vi-VN')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ').trim();
}
function productSearchBigrams(value) {
  const normalized = normalizeProductName(value);
  const grams = new Set();
  for (const ch of normalized) grams.add(ch);
  for (let i = 0; i < normalized.length - 1; i++) grams.add(normalized.slice(i, i + 2));
  return [...grams].slice(0, 140);
}
const now = new Date().toISOString();
const pool = new pg.Pool({ connectionString: urlText, max: 1, connectionTimeoutMillis: 10000 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // Matches GU app transaction lock; inventory writes are paused while checking and applying.
  if (applying) await client.query('SELECT pg_advisory_xact_lock(702546)');
  else await client.query('SELECT pg_advisory_xact_lock_shared(702546)');
  const table = await client.query("SELECT to_regclass('public.gu_documents') AS relation");
  if (!table.rows[0]?.relation) throw new Error('Thiếu gu_documents; chạy db:init trước.');
  const itemsRes = await client.query("SELECT id, data FROM gu_documents WHERE collection='items' ORDER BY id");
  const indexRes = await client.query("SELECT id, data FROM gu_documents WHERE collection='productNameIndex' ORDER BY id");
  const markerRes = await client.query("SELECT data FROM gu_documents WHERE collection='systemMigrations' AND id='product-name-index-v1'");
  const groups = new Map();
  for (const {id, data} of itemsRes.rows) {
    const name = data?.name;
    if (typeof name !== 'string' || !name.trim()) throw new Error('Sản phẩm thiếu tên, ID: ' + id);
    const normalized = normalizeProductName(name);
    if (!normalized) throw new Error('Tên chuẩn hóa rỗng, ID: ' + id);
    const key = encodeURIComponent(normalized);
    if (key.length > 300 || key.includes('/')) throw new Error('Khóa tên quá dài hoặc không hợp lệ, ID: ' + id);
    if (!groups.has(key)) groups.set(key, { normalized, owners: [], name });
    groups.get(key).owners.push(id);
  }
  const existing = new Map(indexRes.rows.map(({id, data}) => [id, data]));
  // Do not remove unknown/orphaned index entries; require human review instead.
  const unexpected = [...existing.keys()].filter(key => !groups.has(key));
  if (unexpected.length) throw new Error('Phát hiện ' + unexpected.length + ' khóa tên có sẵn nhưng không thấy sản phẩm tương ứng: ' + unexpected.slice(0,8).join(', ') + '. Không tự xóa dữ liệu.');
  for (const [key, group] of groups) {
    const row = existing.get(key);
    if (!row) continue;
    const owners = row?.owners;
    if (!Array.isArray(owners) || owners.some(owner => !group.owners.includes(owner))) {
      throw new Error('Chỉ mục tên đang trỏ tới sản phẩm không khớp: ' + key + '. Cần kiểm tra thủ công.');
    }
  }
  const duplicates = [...groups.entries()].filter(([, g]) => g.owners.length > 1);
  const incomplete = markerRes.rows[0]?.data?.completed !== true;
  console.log(JSON.stringify({database:dbName, items:itemsRes.rows.length, uniqueNames:groups.size, duplicateGroups:duplicates.length, existingNameEntries:indexRes.rows.length, migrationCompleted:!incomplete, mode:applying?'APPLY':'PLAN'},null,2));
  for (const [key, group] of duplicates.slice(0, 20)) console.log('TEN_TRUNG:', key, '| product IDs:', group.owners.join(','));
  if (duplicates.length) console.log('CHU Y: Các tên cũ trùng được giữ nguyên; khi tạo sản phẩm mới vẫn chặn tên trùng.');
  if (applying) {
    for (const {id, data} of itemsRes.rows) {
      const normalized = normalizeProductName(data.name);
      const grams = productSearchBigrams(data.name);
      if (data.nameKey !== normalized || JSON.stringify(data.nameSearchBigrams) !== JSON.stringify(grams)) {
        await client.query(`UPDATE gu_documents SET data=jsonb_set(jsonb_set(data,'{nameKey}',to_jsonb($3::text),true),'{nameSearchBigrams}',$4::jsonb,true), updated_at=now() WHERE collection='items' AND id=$1 AND data->>'name'=$2`,[id,data.name,normalized,JSON.stringify(grams)]);
      }
    }
    for (const [key, group] of groups) {
      await client.query(`INSERT INTO gu_documents(collection,id,data) VALUES('productNameIndex',$1,$2::jsonb)
        ON CONFLICT(collection,id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()`,
        [key, JSON.stringify({key:group.normalized,name:group.name,owners:group.owners,updatedAt:now})]);
    }
    await client.query(`INSERT INTO gu_documents(collection,id,data) VALUES('systemMigrations','product-name-index-v1',$1::jsonb)
      ON CONFLICT(collection,id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()`,
      [JSON.stringify({completed:true,completedAt:now,updatedAt:now,processed:itemsRes.rows.length,duplicateGroups:duplicates.length,source:'GU V5 PostgreSQL name migration'})]);
    console.log('SUCCESS: product-name-index-v1 completed. Bây giờ có thể thử nhập kho.');
  } else console.log('PLAN ONLY: không thay đổi PostgreSQL. Để áp dụng, sao lưu trước rồi dùng --apply --confirm-db='+dbName);
  await client.query(applying?'COMMIT':'ROLLBACK');
} catch(e) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('MIGRATION ERROR:',e instanceof Error?e.message:String(e));
  process.exitCode=1;
} finally {client.release();await pool.end();}
