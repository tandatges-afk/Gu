# GU 5.4.6 Fix20.0 · 28/10/2026

- Fix 17: Order UUID retry guard; mutation UUID retry guard; 12-character order suffix; unique order-code index migration gated by read-only preflight; staging PostgreSQL concurrency smoke script.
- Fix 18: Read-only financial/stock/interval/order-code consistency audit and manual reconciliation checklist.
- Fix 19: Debounced add-item search, stale phone-result guard, enabled staff to input replacement value and inspection templates for non-camera inventory at creation.
- Fix 20: Hard request body caps, upload daily quotas, product-photo garbage collection dry-run, encrypted offsite backup GPG/rclone, monitoring timer, controlled manual prod deploy and SHA checks.
- State: Staging candidate only. 317 offline source/unit tests & 15 VPS tests are expected; full npm install/build and DB/UAT pending. Backup/offsite not configured automatically.
- **Compatibility:** GU v5 stage/prod PostgreSQL only; GU6.1 legacy DB untouched; release script now FAILS if name migration or unique/index checks are missing. Indexes are additive; no existing customer or item data was deleted by this patch.
