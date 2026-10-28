import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
/** These source-inspection tests explicitly require deleted Firebase/Cloudinary/Vercel
 * code or legacy data reset scripts. Keep original tests in the archive for audit.
 * All unaffected logic tests run alongside VPS migration-specific tests.
 */
const obsolete=new Set([
 'cloudinary-images.test.ts',
 'gu-v537-cameras-deposits.test.ts',
 'gu-v542-retention-privacy.test.ts',
 'monitoring-diagnostics-v422.test.ts',
 'search-calendar-patch-v501.test.ts',
 'system-longterm-v420.test.ts',
 'v5-beta11-unified-staff.test.ts',
 'v5-beta6-mobile-reset.test.ts',
 'v5-beta8-cloudinary-clean-ui.test.ts',
 'v5-beta8-cloudinary-ui-errors.test.ts',
 'v5-beta9-product-names-ui.test.ts',
 'v536-late-pickup-storage.test.ts',
 'v540-hints-storage-health.test.ts',
 'v541-cloudinary-evidence.test.ts',
]);
const files=readdirSync('tests').filter(f=>f.endsWith('.test.ts')&&!obsolete.has(f)).map(f=>join('tests',f));
console.log(`GU VPS test suite: running ${files.length} files; excludes ${obsolete.size} legacy provider-specific files`);
const result=spawnSync(process.execPath,['--experimental-strip-types','--test',...files],{stdio:'inherit'});
process.exit(result.status??1);
