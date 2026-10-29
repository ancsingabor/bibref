# Spec Kit for Codex

This project uses GitHub Spec Kit 1.2.5 with the Codex integration and Bash
scripts. Shared templates and workflow metadata live in `.specify/`; Codex
skills live in `.agents/skills/speckit-*`. Other local skills remain ignored.

Start a new Codex chat in this repository after setup so it discovers the skills.
Use these prompts in order:

1. `$speckit-constitution` — establish principles from the existing `AGENTS.md`
   and project guidance. The installed constitution is initially a template.
2. `$speckit-specify <feature description>` — write a feature specification.
3. `$speckit-clarify` — resolve unclear requirements when needed.
4. `$speckit-plan` — create an implementation plan.
5. `$speckit-tasks` — break the plan into tasks.
6. `$speckit-analyze` — check consistency before implementation.
7. `$speckit-implement` — execute the tasks.

Keep specifications scoped to the intended engine or hosted application path.
Existing CLI, Qt, WASM, security, state persistence, testing, and deployment
constraints in `AGENTS.md` apply throughout this workflow.

The CLI can be run without a global installation:

```sh
uvx --from 'git+https://github.com/github/spec-kit.git@v1.2.5' specify --help
```

Setup does not install optional extensions or create a feature specification.
See the [official documentation](https://github.github.com/spec-kit/).
