# Rapid Notes

Raycast extension for fast note capture — append selected or typed text to a Markdown file as
checklist items, or create a new timestamped note with frontmatter, all driven by templates with
placeholders.

## Commands

- **Append Rapid Item** — a form to edit the selected/typed text before appending.
- **Append Rapid Item (Silent)** — instantly append the current selection, no UI.
- **New Rapid Note** — create a timestamped note with `created` / `tags` / `title` frontmatter.

## Development

See `CLAUDE.md` for architecture and conventions. Common tasks (Makefile wraps the npm scripts):

- `make check` — lint + test + build
- `make test` — unit tests (Vitest)
- `make dev` — load into Raycast with hot reload
