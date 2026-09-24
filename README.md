# MatchPlay

A collaborative project with protected branches and pull request workflows.

## Branch Structure

- **main** — Production/final product. Protected.
- **develop** — Testing/prototype integration. Protected.
- **feature/** — Individual contributor feature branches.

## Workflow

1. Create a feature branch from `develop`
2. Open a pull request into `develop`
3. Request review
4. After approval and passing checks, merge into `develop`
5. When ready for release, create a pull request from `develop` → `main`
6. After final approval, merge into `main`

See CONTRIBUTING.md for details.
