# Public repository check — 2026-10-15

Scope: tracked files on feat/server-web-vercel, all locally available Git history
and refs, browser assets, and the build/deploy exclusion rules. This is a scoped
credential check, not a guarantee that every possible secret can be detected.

- Gitleaks 8.30.1 scanned all available Git history. Its two findings were public
  40-character hexadecimal APT signing-key fingerprints in historical upstream
  .github/workflows/build.yml versions, not authentication credentials.
- Browser assets passed the Gitleaks scan.
- Four current token/secret values read locally from ignored environment files
  were checked against tracked files; none matched. Values are never included
  in this report.
- .env.local, .env.cookie.local and .vercel/project.json are ignored by Git.
  Environment files and Vercel configuration state have no committed history at
  these paths in the local refs checked.
- Docker and Vercel context exclusions omit local environment files, .git,
  .vercel, provider-installed agent skills, dependencies and generated test files.
- The native child process receives an explicit environment allowlist and does
  not inherit Redis, cookie or deployment credentials; backend tests cover this.
- compose.yaml includes an explicitly development-only cookie key for local use.
  Hosted secrets must continue to be supplied through Vercel environments.
- Server session data and transcripts live in Redis, not the repository.
- Original upstream attribution and module notices remain in place.

Production deployment is separate from Git pushes. Do not add environment files,
credential-bearing logs, local screenshots/transcripts or private keys to commits.
Recheck future changes, especially before adding Python execution.
