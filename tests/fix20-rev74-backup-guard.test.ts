import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const get=(p:string)=>readFileSync(p,'utf8');

test('Rev7.5 Production backup service is local root-only and cannot silently skip backup',()=>{
 const unit=get('deploy-vps/gu-fix20-prod-backup.service');
 const doctor=get('deploy-vps/gu-fix20-backup-doctor.sh');
 const script=get('deploy-vps/gu-fix20-local-prod-backup.sh');
 const deploy=get('vps-main/gu-v5-release');
 assert.match(unit,/EnvironmentFile=\/etc\/gu-v546\/prod\.env/);
 assert.doesNotMatch(unit,/backup-prod\.env|rclone/);
 assert.match(unit,/ExecStartPre=\/usr\/local\/sbin\/gu-fix20-backup-doctor --service/);
 assert.match(unit,/ExecStart=\/usr\/local\/sbin\/gu-fix20-local-prod-backup/);
 assert.match(doctor,/GU_BACKUP_PREFLIGHT_FAILED/);
 assert.match(script,/pg_dump -Fc/);
 assert.match(script,/pg_restore --list/);
 assert.match(script,/sha256sum -c SHA256SUMS/);
 assert.match(script,/tar -tzf/);
 assert.match(script,/GU_LOCAL_BACKUP_OK/);
 assert.match(deploy,/gu-fix20-backup-doctor --host/);
 assert.match(deploy,/systemctl start gu-fix20-prod-backup\.service/);
 assert.match(deploy,/Local backup failed; Production unchanged/);
});
test('Rev7.5 installer is opt-in and does not enable Production or silently restart services',()=>{
 const installer=get('deploy-vps/install-gu-auto-prod-backup.sh');
 assert.doesNotMatch(installer,/systemctl (start|enable) gu-fix20-prod-backup/);
 assert.doesNotMatch(installer,/install .*PRODUCTION_APPROVED/);
 assert.match(installer,/systemctl daemon-reload/);
});
