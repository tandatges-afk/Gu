# GU v5.3.0-beta.1 TypeScript hotfix

## Fixes
- `src/lib/http.ts`: import `currentStaffAccess`, `isoWeekMonday`, `vnDate` and the `ShiftWeekRecord` type from `shift-schedule.ts`. These identifiers were referenced without an import, causing 7 TS2304/TS2552 errors and making `next build` fail during type checking.
- `tests/shift-schedule-v53.test.ts`: explicitly type `roster` as `ShiftWeekRecord['seats']`. This resolves 4 TS7053/TS7006 diagnostics arising from inference of `{}`.

No business logic, database schemas, roles, Firebase configuration or environment variables changed. `package.json` remains `5.3.0-beta.1` for compatibility with existing version checks; this is a hotfix to that release.

Run in Codespaces:

```bash
npm run test
npm run verify:release
npm run typecheck
npm run build
```

The included package has no `.env.local`, credentials or `.git` folder. Preserve your own `.env.local`.
