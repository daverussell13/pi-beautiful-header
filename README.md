# pi-claude-code-tui

A pi package that gives startup a polished Pi header while keeping pi's original footer.

![Screenshot](./assets/screenshot.png)

## Installation

Install from npm globally for your user:

```bash
pi install npm:pi-claude-code-tui
```

Or install it only for the current project:

```bash
pi install -l npm:pi-claude-code-tui
```

Try it for one run without installing:

```bash
pi -e npm:pi-claude-code-tui
```

## What it changes

- Theme-accent rounded header border
- Animated Pi logo matching the dynamic color-changing mark from `curl -fsSL https://pi.dev/install.sh | sh`, settling into the accent color
- Center title/tagline: `Pi Coding Agent`, `v<pi version>`, and `There are many agent harnesses, but this one is yours.`
- Right-side startup info panel on wide terminals (`Context`, `Skills`, `Extensions`, and `Themes`)
- Keeps pi's original input box and cursor
- Keeps pi's original footer and spinner, with Claude-style rotating working verbs

## Local development

Run the package locally in pi:

```bash
pi -e .
```

Validate changes before publishing:

```bash
npm run typecheck
npm test
npm pack --dry-run
```

## Commands

- `/use-claude-code-tui` — switch to this package's look (Pi header)
- `/use-default-tui` — switch back to pi's built-in header, footer, and spinner

## License

MIT
