# Oracle → Drive → Progress: one-owner handoff protocol

**Status:** proposed pilot · **Mode:** standalone (manual, no daemon) · **Scope:** private engineering handoffs
**Starting references:** the Owner's Drive **Handoffs** folder; \`Common/relay\` at \`04226c944f417482d8335829faedfb77eafcae1a\`; this Progress Page's current CLI.

## Aim

Let the Owner see **who has the file, who has the next action, which exact
candidate was checked, and what still blocks acceptance** without copying ZIPs
between chats unnecessarily. Trace every material status change with the
already-existing Progress Page audit chain; **do not create a competing ledger**.

This is a human-mediated pilot, not an automatic cross-chat service. A chat-ID
suffix is a display label, not an authenticated identity, delivery receipt or
independence guarantee.

## Authoritative surfaces: one meaning per place

| Surface | Authoritative for | Not authoritative for |
|---|---|---|
| **Owner's Google Drive Handoffs folder** | Actual private ZIP/test artifacts, readme, SHA-256 receipts and access permissions | Whether a reviewer judged them correct or whether the Owner accepted |
| **Progress Page** | One public-safe project board: assignments, short chat IDs, current claims, next actor, and versioned status updates | Private bytes, Drive permission correctness, authenticated chat delivery |
| **Progress Page \`audit.json\` via \`pp_cli.py\`** | Changes made to this board, one source and timestamp per update | A record of all historical chat/Drive events or proof of their truth |
| **Existing \`Common/relay\`** | Its *own* active execution/custody records; useful design for scoped events, checkpoints and leases | A general-purpose P2.5-B inbox; do not mutate another work package's \`relay/STATE.yaml\` |

Use an **opaque receipt ID**, e.g. \`HND-20261024-001\`, privately in
the Drive manifest and in sanitized Progress text. Do not put customer CII/XML,
whole chat URLs, private ZIP links, approval keys, usernames/emails or unrestricted
folder listings in the public JSON. A public project may display an **explicitly
Owner-approved Drive folder URL** under the new limited policy described below.

## One handoff, three attestations, two separate decisions

Each artifact has an exact bytes identity (SHA-256 computed from the actual
downloaded file), a candidate/version identity, and a recipient. Never confuse:

1. \`OWNER_REPORTED\` — Owner says an attachment was sent; a useful report,
   but not a recipient readback.
2. \`RECIPIENT_CONFIRMED\` — recipient confirms receipt, names the file and
   its intended purpose. No byte equivalence implied.
3. \`BYTES_VERIFIED\` — recipient downloads actual bytes, computes size and
   SHA-256, checks ZIP integrity and matches expected candidate. No functional
   PASS implied.
4. \`SELF_TESTED\` — coder ran named tests on the specific new candidate;
   still not independent verification.
5. \`INDEPENDENTLY_REVIEWED\` — reviewer produces a scoped evidence verdict
   on exact new candidate bytes. Distinguish PASS, FAIL, BLOCKED, NOT_RUN.
6. \`OWNER_ACCEPTED\` — explicit Owner acceptance of the stated product scope,
   never inferred from a test count, hash match or folder upload.

Stages 4–6 are **not** interchangeable and need not all occur for every low-risk
task. Stage 6 is reserved for actual acceptance when required.

### Minimum private handoff receipt

Save in the per-project folder alongside the ZIP, or as a private handoff
document that only authorized actors can access:

\`\`\`text
receipt_id: HND-20261024-001
project: p25b
from_role: Coder
from_chat_id8: <Owner-reported display ID>
to_role: Independent Reviewer
to_chat_id8: <Owner-reported display ID>
task: review repaired UI candidate, exact version
artifact: <filename, bytes, SHA-256, ZIP integrity>
original_parent: <previous exact artifact SHA-256 or UNKNOWN>
delivered_at: <observed UTC time or UNKNOWN>
delivery_state: OWNER_REPORTED | RECIPIENT_CONFIRMED | BYTES_VERIFIED
review_scope: <fields/checks, actual tool and known exclusions>
return: <finding receipt ID, new artifact if relevant, not-run items>
privacy: PRIVATE_HANDOFF
\`\`\`

An expected hash is a **condition**, not proof. Do not rename or rebuild
the ZIP to match an expected hash. The actual recipient's measurement
is the confirmation. Retain old receipts; corrections append new findings.

## Progress Page representation — a small standalone P2.5-B tab

Use a new \`p25b\` standalone project rather than silently overwriting the
older \`ciifr\` cards from another workstream. Its first aim is:

> Trace the exact P2.5-B implementation, private artifact handoffs, independent
> review and genuine Owner Windows acceptance without weakening frozen P2.1.

Three short chat labels identify where to route messages; full chat links are
resolved privately in the Owner's local \`pp_links\` setup. Suggested cards:

| Card | What it displays | Safe state |
|---|---|---|
| \`oracle\` | Decision and next actor | IN_PROGRESS |
| \`coder\` | Candidate/version, self-test and exact handoff receipt | SUBMITTED when result returned |
| \`reviewer\` | Exact-scope independent findings; remaining package checks | IN_PROGRESS or BLOCKED |
| \`windows\` | Native browser user walkthrough, output audit, Owner decision | NOT_STARTED until run |

Keep a **single** next action on the Owner-facing board. Use \`VERIFIED\`
on a card only for its demonstrated scope and name that scope in \`now\`.
Do not use it to imply total P2.5-B acceptance. Maintain blocked gates in
a short card description, not in a hidden optimistic status.

### CLI-only updates — examples (run in a checked-out Progress Page repo)

Commands below are **examples, not executed actions**. Supply actual verified
receipt IDs, short chat labels and approved source refs. A CLI write automatically
appends the existing Timeline/audit event and rolls back if checking fails.
Do not hand-edit \`data/projects.json\`, \`cards.json\` or \`audit.json\`.

\`\`\`sh
python tools/pp_cli.py project add \
  --key p25b --title "P2.5-B Handshake" --label "P2.5-B" \
  --mode standalone --coordinator Oracle \
  --aim "Trace P2.5-B artifact handoffs, scoped review and Owner Windows acceptance while preserving frozen P2.1." \
  --owner-words "Make the multi-agent handoffs traceable and updateable in Progress Page" \
  --actor Oracle --src OWNER_PRIVATE_REF:p25b-owner-aim \
  --why "Create one separate P2.5-B evidence and routing board"

python tools/pp_cli.py plan chat --project p25b \
  --id coder --label "P2.5-B coder" --id8 "<coder-id8>" --engine ChatGPT \
  --actor Oracle --src OWNER_PRIVATE_REF:p25b-role-registration \
  --summary "Register coder destination"

python tools/pp_cli.py card set --project p25b --card coder \
  --label "Preview repair" --chat coder --role Coder \
  --milestone M2 --state SUBMITTED \
  --now "Repaired candidate returned; exact identity and independent findings tracked by receipt HND-..." \
  --next-actor "Independent Reviewer" \
  --next-text "Verify code-only distribution; confirm actual bytes and scope" \
  --actor Oracle --src OWNER_PRIVATE_REF:p25b-handoff-receipt \
  --summary "Record coder handoff without claiming Owner acceptance"
\`\`\`

Repeat \`plan chat\` for Oracle and Independent Reviewer, and \`card set\`
for each relevant agent and Owner acceptance. Link related cards by
\`--edge\` only where useful. Use normal \`check\` and
\`check --base origin/main\` prior to a reviewed PR/merge.

### Owner-authorized Drive folder link exception

The default rule continues to **reject Drive files, Docs links, email, tokens
and whole chat links** from public project data.

The Owner can explicitly approve a **folder locator** for public display.
Add it only as a grounding-fixture URL with the precise
\`--status OWNER_APPROVED_PUBLIC_FOLDER\` marker:

\`\`\`sh
python tools/pp_cli.py fixture add \
  --project p25b --list inputs \
  --text "Owner-authorized handoff folder (Drive access still governed by permissions)" \
  --url "https://drive.google.com/drive/folders/<approved-folder-id>" \
  --status OWNER_APPROVED_PUBLIC_FOLDER \
  --actor Oracle --src OWNER_PRIVATE_REF:p25b-owner-drive-approval \
  --summary "Owner permits this folder locator to appear publicly"
\`\`\`

Use the canonical Drive **folder** URL, not a file URL. The checker
also permits its optional \`?usp=drive_link\` sharing suffix. The marker
does not automatically change Google Drive permissions, authenticate viewers,
or prove the contents are private. **A public GitHub PR containing the URL
exposes the folder ID immediately, even while DRAFT.** Confirm sharing/access
policy and file visibility *before* executing this specific CLI command.

Source evidence (\`--src\`) remains a public GitHub link or an opaque
\`OWNER_PRIVATE_REF\`; **do not** treat the Drive URL itself as authoritative
evidence or make customer artifact links into public sources.

## Optional later automation (not part of this manual pilot)

After a real manual handoff/update succeeds, a **separately authorized and
authenticated bridge** may:

1. Read *only* a project's approved Drive handoff directory.
2. Validate an immutable receipt and digest against downloaded ZIP bytes.
3. Capture recipient confirmation and review verdict from actually authorized
   sources; never infer them from the presence of a file.
4. Propose \`pp_cli.py\` commands in a dedicated PR branch, preserving the
   append-only audit and source references.
5. Validate \`check\` / \`check --base\`; never directly push to \`main\`,
   post customer IDs publicly, accept for the Owner, or edit the live
   \`Common/relay\` custody state.

Drive listing/file metadata is insufficient to establish genuine SHA-256
content identity when the recipient did not download and hash bytes. GitHub
commit success is not proof a browser displayed the change. The bridge should
be disabled until one full pilot demonstrates access, permissions and evidence.

## Negative checks that block status promotion

- File is reportedly attached but not downloadable to coder: **OWNER_REPORTED**,
  not \`BYTES_VERIFIED\`.
- ZIP hash is wrong: do not patch; ask for exact source artifact and retain
  expectation/observation.
- Preview passes with injected Chromium HTTP transport: scope is **injected**;
  native Windows remains NOT_RUN.
- Repaired runnable reviewed but code-only distribution absent: keep code-only
  **BLOCKED**; do not recycle an older code-only ZIP.
- Independent reviewer is a different conversation but used a shared expectation:
  record shared lineage; don't claim universal independent assurance.
- Progress Page entry updates without a new audit event: reject the proposed
  data change and use the official CLI.
- Public link exposes a customer file or a Drive child file URL: reject unless a
  separate, explicit publication scope is authorized and validated.

## Acceptance of the pilot

A successful first use has **one real artifact, one confirmed receiving chat,
one byte-checked receipt, one correct public-safe card transition and one
successful Progress checker run**. A subsequent reviewer verdict must remain
bounded to the candidate and tests actually used.

The Owner sees the **same next role/chat ID and scope on the Progress Page and
in Oracle's routing response**, without asking which chat to paste into.
Manual operation remains supported; no background worker is promised.
