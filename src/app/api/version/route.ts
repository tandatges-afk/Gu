import { NextResponse } from 'next/server';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const root = process.cwd();
  let version = 'unknown';
  let commit: string | null = null;
  let builtAt: string | null = null;

  try {
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { version?: string };
    version = pkg.version || 'unknown';
  } catch { /* app metadata is unavailable */ }

  try {
    const value = (await readFile(join(root, '.gu-deploy-commit'), 'utf8')).trim();
    if (/^[0-9a-f]{40}$/i.test(value)) commit = value;
  } catch { /* initial manual deployment has no commit marker */ }

  try {
    builtAt = (await stat(join(root, '.next', 'BUILD_ID'))).mtime.toISOString();
  } catch { /* build time is unavailable */ }

  return NextResponse.json(
    { app: 'GU', version, deploySource: commit ? 'github-main' : 'manual-or-unknown', commit, builtAt },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
