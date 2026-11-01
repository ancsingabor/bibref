# Spec Kit for Codex

This project uses GitHub Spec Kit 1.2.5 with the Codex integration and Bash
scripts. Shared templates and workflow metadata live in `.specify/`; Codex
skills live in `.agents/skills/speckit-*`. Other local skills remain ignored.

Start a new Codex chat in this repository after setup so it discovers the skills.
Use these prompts in order:

1. `$speckit-constitution` — maintain `.specify/memory/constitution.md` using the documented
   constraints in `server/README.md`, `server/PYTHON.md`,
   `docker/cli/web/README.md`, and `next-steps.md`.
2. `$speckit-specify <feature description>` — write a feature specification.
3. `$speckit-clarify` — resolve unclear requirements when needed.
4. `$speckit-plan` — create an implementation plan.
5. `$speckit-tasks` — break the plan into tasks.
6. `$speckit-analyze` — check consistency before implementation.
7. `$speckit-implement` — execute the tasks.

Keep specifications scoped to the intended engine or hosted application path.
Existing CLI, Qt, WASM, security, state persistence, testing, and deployment
constraints in those documents apply throughout this workflow. There is no repository-root
`AGENTS.md`; do not infer additional principles from that stale reference.

The CLI can be run without a global installation:

```sh
uvx --from 'git+https://github.com/github/spec-kit.git@v1.2.5' specify --help
```

SpecGuard 0.2.0 is installed from the local `../specguard/extensions/specguard`
checkout through Spec Kit. Its mandatory prepare hook runs before implementation,
optional review hook after analysis, and mandatory verify hook after implementation.
Installed command skills resolve `.specify/extensions/specguard/` and its five
bundled templates. These hooks are agent-followed gates, not execution authority.

Preparation requires explicit agreement on a bounded evidence plan. Review requires
a separate concrete one-attempt execution decision. Do not run checks merely because
a configuration exists. Preserve private configuration and prior evidence; use fresh
private destinations outside public checkouts. No application checks were run during
installation. The reserved `auto_execute_hooks` setting is not an enforcement guarantee.
See the [official documentation](https://github.github.com/spec-kit/).
