# Phase 0: Provenance & Trust

Run this **first**, before reading a single line of logic. It is cheap, it is fast, and it
reorders everything that follows.

> **Why this phase exists.** Across independent sources, the dominant delivery vector for FiveM
> backdoors is not a clever zero-day — it is a **leaked, nulled, or cracked paid script**. Someone
> cracks a resource, inserts a loader, and re-releases it for free. The "free" copy of a script
> that normally costs money *is* the attack. A resource's origin therefore predicts its risk better
> than any single code pattern, and no amount of pattern matching recovers that context after the
> fact.

Provenance does not produce findings on its own. It sets the **prior** — how hard to look, and how
much weight to give a SUSPECTED pattern later.

## 0.1 Establish origin (ask; do not guess)

```
[ ] Where did this resource come from? Official Tebex / Cfx keymaster / vendor GitHub / a leak
    site / a Discord / "a friend sent it" / unknown
[ ] Is it a paid resource obtained for free? → treat as HOSTILE UNTIL PROVEN OTHERWISE
[ ] Is the vendor identifiable and still active (repo, store page, support channel)?
[ ] Does a known-good reference copy exist to diff against (official release, git history, a
    previous deploy)? If yes, DIFF IT — a diff finds an injected loader in seconds
[ ] For an in-house resource: is it in version control, and does the working copy match HEAD?
```

When the resource is under git, do this before reading anything — an injected file or a modified
line shows up immediately and reorders the whole audit:

```bash
git status --short            # untracked/modified files that should not be there
git log --oneline -15         # unexpected or unattributed commits
git diff HEAD                 # uncommitted modifications to a deployed resource
```

A tracked resource with **untracked `.lua` files** in it, or a modification nobody made, is the
single strongest signal in this entire skill. Chase it before anything else.

If the user cannot say where it came from, say so in the report. "Origin unknown" is itself a
finding — it means no integrity baseline exists.

## 0.2 Trust tiers

Set the tier explicitly and state it in the report. It changes the standard of proof.

| Tier | Source | Posture |
|------|--------|---------|
| **T1 — Trusted** | Own code in VCS; official open-source (overextended, qbox); vendor release bought through Tebex/keymaster | Audit normally. Flag confirmed issues. |
| **T2 — Semi-trusted** | Public GitHub, unknown-but-real author, community release | Audit normally, but verify every external endpoint and every dynamic-execution site. |
| **T3 — Untrusted** | Leaked / nulled / cracked / "free" copy of a paid script; forwarded file with no origin; anything from a leak forum or random Discord | **Assume a backdoor is present and look for it.** Report SUSPECTED findings that would be noise at T1. Recommend not deploying it at all. |

**A T3 resource that scans clean is not "clean" — it is "no backdoor found."** Say it that way.
Obfuscated or escrowed regions in a T3 resource make even that statement impossible.

## 0.3 Repack & crack indicators (HIGH)

These say "somebody has been inside this resource since the vendor shipped it":

```
[ ] Escrow EXPECTED but source is fully readable → the escrow was stripped. Cracked build; whoever
    stripped it had every opportunity to add code
[ ] .fxap absent from a resource that advertises escrow protection, or escrow_ignore listing files
    that clearly should be encrypted
[ ] fxmanifest paths altered — Cfx escrow integrity keys off exact paths in fxmanifest.lua, so path
    edits in a "protected" resource indicate tampering
[ ] Mixed code style / indentation / naming inside one file or between sibling files (a graft)
[ ] One file with a much newer mtime than the rest of the resource
[ ] A file not referenced by fxmanifest (orphan), or a manifest entry with no matching original
[ ] Version string, README or store link inconsistent with the actual code
[ ] Vendor's own anti-tamper / license check removed or commented out (the cracker had to do this,
    and it proves modification even if you cannot find the payload)
```

> **"Escrow bypass" tooling is not a real decrypter.** What circulates under that name is scams and
> backdoored rebuilds. If a resource reached the user through such a tool, treat it as T3 and
> recommend deleting it — there is no safe way to use it.

## 0.4 Purpose/capability mismatch (HIGH — the highest-signal manual check)

Compare what the resource *claims to be* against what it *reaches for*. A capability with no reason
to exist is worth more than any signature match.

```
[ ] A UI-only resource that makes HTTP requests, reads convars, or touches permissions
[ ] A cosmetic/HUD resource with database access or player identifier enumeration
[ ] A single-purpose script that enumerates OTHER resources (GetNumResources, GetResourceByFindIndex)
[ ] A resource that reads server.cfg, txData, or credential convars for any stated reason
[ ] Admin/permission grants in a resource that is not an admin resource
[ ] Networking code in something advertised as fully standalone/client-side
[ ] Obfuscation in a resource with no commercial reason to hide anything — legitimate paid
    protection is Cfx escrow, NOT hand-rolled obfuscation. A "free" obfuscated script is a
    red flag on its own
```

Write mismatches up as findings with the mismatch stated plainly: *"this is a speedometer that
reads `mysql_connection_string`."* That sentence is the whole argument.

## 0.5 Integrity baseline to recommend going forward

Regardless of outcome, the operator should leave with a baseline so the *next* injection is
detectable:

```
[ ] Resources tracked in git (or hashed) so post-deploy modification is visible
[ ] Known-good copies retained for every third-party resource actually deployed
[ ] A runtime file-integrity/scan-on-start monitor for what slips in later (see the Static vs
    Runtime note in SKILL.md)
[ ] Paid resources re-downloaded from the vendor rather than copied between servers
```

## 0.6 Reporting

Add to the report header:

```
Provenance: T1 Trusted | T2 Semi-trusted | T3 Untrusted | UNKNOWN
Reference copy available for diff: YES / NO
Repack indicators: none / list them
```

If tier is T3, the verdict line must say so even when the score is high — a clean read of an
untrusted binary-ish artifact is a weak guarantee, and the report should not imply otherwise.
