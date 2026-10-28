# CIIFR WBS 3 — reviewed native-source projection proposal (NOT APPLIED)

This is an **Owner-directed, writer-custody-respecting proposal**, not an activated update. Page `data/ciifr/**` and the audited Timeline are intentionally **unchanged** on this proposal branch. The sole designated CIIFR Page writer owns the one audited publication using original sources and normal PR checks.

## Grounded evidence

- [Native task #180](https://github.com/reallakshman19/XML_Compare_Utilities/issues/180) is open at native `updated_at=2026-10-27T05:43:52Z` when these proposals were prepared.
- [Native PR #191](https://github.com/reallakshman19/XML_Compare_Utilities/pull/191) **MERGED** on `2026-10-27T06:22:24Z`, exact source head `7d7d100c51a4ccebc2b9ba877ebb6e337e1a591a`, native merge `a55d7730152165e83843b24ca3d926b8f0877952`. Merge does **not** qualify browser/GPU/Owner acceptance; original reviewer and recorded NOT_RUN limits remain.
- Existing Page `geo-g1` card is an **open** G1 card under milestone `M13` (WBS 3.1). Its existing state, actor, next, source, milestones and capability must remain unchanged.
- Existing CIIFR Cycle rev18 still carries stale merge wording; [Common draft PR #555](https://github.com/reallakshman19/Common/pull/555) proposes a separate canonical correction for Oracle review.

## Sole writer: exact checked update route

Use a clean Page checkout at the then-current main and **recreate** proposals from native GitHub if either source fingerprint has drifted.

```sh
# Regenerate source-fresh proposals rather than trusting old observation times.
python tools/pp_cli.py --data data propose --project ciifr --actor 'CIIFR designated Page writer' \
  --card geo-g1 --source https://github.com/reallakshman19/XML_Compare_Utilities/issues/180 --output /tmp/ciifr-issue180.json
python tools/pp_cli.py --data data propose --project ciifr --actor 'CIIFR designated Page writer' \
  --card geo-g1 --source https://github.com/reallakshman19/XML_Compare_Utilities/pull/191 --expected-head 7d7d100c51a4ccebc2b9ba877ebb6e337e1a591a --output /tmp/ciifr-pr191.json
# Review source scope; dry-run both first:
python tools/pp_batch.py /tmp/ciifr-issue180.json --data data
python tools/pp_batch.py /tmp/ciifr-pr191.json --data data
# Only writer with current checkout, approved custody and fresh identities:
python tools/pp_batch.py /tmp/ciifr-issue180.json --data data --apply --base origin/main
python tools/pp_batch.py /tmp/ciifr-pr191.json --data data --apply --base origin/main
python tools/pp_cli.py --data data check
python tools/pp_cli.py --data data check --base origin/main
```

The sample JSONs in this folder preserve the **observed** native identity and the approved v1 one-reference shape; they are examples/preimages to review, not permission to apply a stale fingerprint. The writer should publish **one checked data PR** with two audited source references on existing `geo-g1` and only the changed checked JSON/Timeline files. If the source already appears, stop instead of double-recording. Review and merge under Page writer custody; no extra production-agent status/acknowledgement.

**Acceptance check:** WBS 3.1 source links include both #180 and merged PR #191; existing card state/next/capability unchanged, exactly two new append-only audited source events, source identities still current at apply and all Page checks pass. Canonical Cycle publication status is separately reconciled by the incumbent Oracle after actual Page merge/readback, not pre-emptively.

**Production first. Evidence once. No duplicate reporting.**
