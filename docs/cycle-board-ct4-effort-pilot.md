# CT-4 effort pilot — optional, read-only, self-reported arithmetic

CT-4 is governed by [existing Issue #80](https://github.com/reallakshman19/progress-page/issues/80). This instrument does **not** measure anyone automatically, publish the Page, add a worker report, authenticate a Github source or prove acceptance. It never grants savings or Owner acceptance: `optimized_claim_allowed` is **always false**. Independent evidence qualification and real Owner trial live outside this script, in the existing CT-4 review.

## Run

```sh
python tools/ct4_effort.py --input tests/fixtures/ct4_effort_blank.json
```

The supplied receipt is all `NOT_RUN` and `null`, not observed zero. Copy it privately for a real authorized trial. Do not paste private chat links, tokens or protected evidence. Evidence references must be syntactically valid public GitHub HTTPS issue/PR/commit/run URLs; a valid URL **does not establish its truth, contents or independence**. A syntactically valid 40-character head is not verified against GitHub by this offline tool. A declared Owner trial `PASS` is only **self-reported** and does not establish Owner acceptance.

## CIIFR-Node trial is native-source reconciliation, not Cycle activation

The two `NOT_RUN` cohorts refer to one common workflow,
`native-evidence-reconciliation` / `one-native-occurrence`, spanning **3**
matched source cases (PR #232 current immutable head, Issue #231 revision,
historic PR #226 legacy URL-only case). CIIFR-Node has no established
standalone canonical Cycle; never call its trial a `Cycle now` continuation
or assignment. These source URLs are **case targets, not pre-recorded trial
measurements**. Recheck identities at the time of the actual trial.

## Minutes and unit basis (required)

For each role, record actual **active minutes per case** separately in
the real evidence receipt. For `sample_count: 3`, set each
`role_minutes` input to the **arithmetic mean across the three cases**,
`sum(case_1, case_2, case_3) / 3`. Similarly,
`maintenance_minutes_per_run` is the *mean recurring maintenance minutes
per case/run*. Set `setup_minutes` to the **one-time setup/build minutes**,
only if those minutes were *not* included in role active minutes; amortize
that amount over `amortization_runs: 10` future comparable runs. The
mandatory `input_basis` values must be exactly
`role_minutes: PER_RUN_MEAN`, `maintenance_minutes_per_run: PER_RUN_MEAN`,
and `setup_minutes: ONE_TIME`. Raw three-case totals are **not valid inputs**
and must be divided before entry; labeling a total as a mean is not
detectable by this offline tool and needs independent source review.

A synthetic example: three Coder timings 12, 15, 15 minutes mean
**14 minutes per run**, not 42; three maintenance samples 2, 3, 4 mean
**3 per run**; one-time setup of 20 contributes **20/10 = 2 per run**
and is not also included in Coder minutes. This is not measured trial data.

## Comparable cohorts are mandatory

For both `baseline` and `pilot` `status: OBSERVED`, include the same `scope.project`, `scope.workflow`, `scope.work_unit` and `scope.sample_count` (positive integer). `project` must match the Page project key. State the common `amortization_runs` horizon explicitly. The instrument rejects different scopes rather than comparing different work. Every measured cohort records the five roles (Coder, IR, Oracle/OTM, Owner, Page writer) as **per-run mean** active minutes, one-time setup minutes, **per-run mean** maintenance, zero or greater **observed** extra mandatory Board posts, and source references. Exclude idle waiting. First-runnable/recovery timings are descriptive, not double-counted.

`T_total(N) = sum(five role active minutes) + maintenance/run + setup/N`.

The output distinguishes **provisional self-reported arithmetic** (`provisional_self_reported_minutes_difference_per_run`) from verified savings (`optimized_claim_allowed: false`). Self-asserted verified flags are ignored. Reported trial `PASS` or `FAIL` requires an HTTPS source PR, well-formed exact-head string, runnable HTTP(S) URL (plain HTTP only for localhost), and source references. All remain unverified by this offline instrument.

A positive number is **not** an independently verified improvement. CT-4's actual CIIFR-Node/CIIFR/Grade9 multi-project falsification, reviewed Owner trial, baseline comparability, release permission and published Page status must be assessed separately by an authorized non-author reviewer and Owner in Issue #80. No system-wide time savings claim follows from one local calculation.
