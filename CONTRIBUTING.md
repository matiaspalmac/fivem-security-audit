# Contributing

Threat intel goes stale fast. The most valuable contribution here is a pattern the checks miss.

## What's most useful

- **A new attack pattern** — a dupe class, an event-forgery trick, a crash vector, a framework pitfall.
- **Threat intel** — a new C2 domain or IP, a malware family marker, an obfuscation technique.
- **A correction** — a check that is wrong, outdated, or that fires on legitimate code.

That last one matters as much as the first. A check that produces false positives trains people to
ignore the report.

## Repo layout

```
SKILL.md          Entry point: threat model, modes, workflow, report format, scoring
checks/           One file per phase — the detailed checklists
  provenance.md     Phase 0 — origin, trust tier, repack indicators
  security.md       Phase 1 — exploitable code
  malware.md        Phase 1b — backdoors, supply chain
  performance.md    Phase 2
  cleanup.md        Phase 3
  compatibility.md  Phase 4 — manifest, escrow, RedM, Enhanced
  architecture.md   Phase 5 — quality grade
examples/         Fixture corpus + EXPECTED.md validation oracle
```

Most changes belong in one `checks/` file. Touch `SKILL.md` only when adding a phase, a report
section, or a scoring rule.

## The evidence standard

This tool tells people their server is or is not safe, so a wrong claim is worse than a missing one.

- **Cite a source** for anything factual — a Cfx doc, a GitHub issue or release, an advisory, a
  vendor changelog. Link it inline.
- **Do not assert version numbers or convar names from memory.** Both change, and both have been
  wrong here before: a previous release recommended `sv_enableDevtools`, a convar that does not
  exist. Verify against the actual repository or documentation.
- **Prefer a durable rule over a perishable list.** "Every external endpoint needs an identifiable
  purpose" survives new domains; a hardcoded blocklist does not.
- If something is uncertain, write it as uncertain. The skill is explicitly required to distinguish
  CONFIRMED from SUSPECTED, and the checks should model that.

## Adding a detection

Include all four, or it is not actionable:

1. **The pattern** — what the vulnerable code actually looks like.
2. **The exploit** — concretely how it is abused. If you cannot describe the attack, it is a style
   preference, not a finding.
3. **The fix** — copy-pasteable.
4. **The false-positive guard** — what legitimate code looks similar, and how to tell them apart.

Flag *dangerous combinations*, never primitives in isolation. `PerformHttpRequest` is a webhook.
`PerformHttpRequest` feeding `load()` is a backdoor. Severity goes on the combination.

## Fixtures

If you add a check, exercise it in `examples/`:

- Add the vulnerable pattern to `examples/vulnerable_shop/`.
- Add the correct counterpart to `examples/secure_shop/` — this is the false-positive control.
- Record both in `examples/EXPECTED.md`: the expected finding, and the trap that must **not** fire.

## Before you open the PR

```bash
node .github/validate.mjs      # frontmatter + package integrity
```

CI runs this on every push. Then run the skill against both fixtures and compare with
`EXPECTED.md` — a missed CRITICAL or a flagged clean file is a regression.

## House rules

- One purpose per PR; open an issue first for anything large.
- Match the surrounding style.
- No secrets, tokens, or credentials — including in fixtures.
- **No live malware in the repo.** The corpus ships vulnerable patterns and non-functional,
  commented examples only.
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`).
