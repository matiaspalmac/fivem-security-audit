# Validation fixtures

Test corpus for `fivem-security-audit`. Two resources:

- **`vulnerable_shop/`** — deliberately insecure ESX-style shop. Every flaw is intentional and documented inline.
- **`secure_shop/`** — the hardened counterpart. A correct audit reports 0 CRITICAL/HIGH and no false positives.

[`EXPECTED.md`](EXPECTED.md) is the oracle: the exact findings each fixture should produce. Use it as a regression check after editing the skill or its `checks/`.

These fixtures are **not** shipped in the npm package (excluded from `package.json` `files`) — they live in the repo for development only. None contain working malware; the backdoor pattern is left commented and non-functional.
