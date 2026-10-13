# Lane (internal, private)

De-identified Medicare reference-price desk for New York. Not a payment, not an EHR. Full notes: `docs/HANDOFF.md`.

## The four teams

| Team | What it does | What it does not do |
|---|---|---|
| Intake | Reads each line: code, date, and charge. | Does not invent a code that is not written on the line. |
| Price | Shows one code and the amount for each year on the file. | Does not guess a code the file does not contain. |
| New York | Uses the county the file names. Personal care is the January 1, 2024 workbook. | Does not use one county's rate for another county. |
| Review | Marks a charge that does not match the file. | Does not send the bill. A person decides. |

## Setup
```
nvm use                 # Node 22.12 (.nvmrc; engines ">=22.12.0 <23")
npm ci                  # install exactly what package-lock.json pins
npm run hooks:install   # once per clone: pre-commit secret scan (gitleaks)
```
`npm run hooks:install` sets `git config core.hooksPath scripts/hooks`, so `scripts/hooks/pre-commit` runs
`gitleaks git --pre-commit --staged --redact` on every commit. It needs gitleaks 8.21+ on PATH (or `GITLEAKS=/path/to/gitleaks`);
without it the commit is refused. CI (`.github/workflows/gitleaks.yml`) scans the full history and tree on every push.

## Run and check
```
npm run dev                             # public mode, http://localhost:8080
npm run lint && npm run typecheck && npm test && npm run check
npm run build && npm run check:output   # public production build (prunes held-back files), then checks the output
npm run build:internal                  # internal production build, local e2e only (never on Vercel)
```
Env vars: see `env.example`. A Vercel deploy is public only.
