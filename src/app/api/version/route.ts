import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const cwd = process.cwd();
  let version = 'unknown';
  let commit = process.env.GU_DEPLOY_COMMIT || 'untracked';
  try {
    const pkg = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8'));
    version = String(pkg.version || version);
  } catch { /* package metadata unavailable */ }
  try {
    const sha = (await readFile(join(cwd, '.gu-deploy-commit'), 'utf8')).trim();
    if (/^[a-f0-9]{40}$/.test(sha)) commit = sha;
  } catch { /* local run */ }
  return NextResponse.json({ app: 'GU - Thuê đồ xinh', version, database: 'PostgreSQL',
    deployment: commit === 'untracked' ? 'local' : 'github-main', commit },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}
