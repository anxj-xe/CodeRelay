
# CodeRelay

Capture accepted coding submissions and automatically synchronize them with Git repositories.

## Features

- Automatic coding submission capture
- Platform-specific adapters
- Local solution management
- Git integration
- Cross-platform architecture

## Architecture

- `apps/extension`: Browser extension
- `apps/cli`: Command-line interface
- `packages/core`: Application engine
- `packages/git`: Git integration
- `packages/shared`: Shared types and utilities
- `packages/platform-adapters`: Coding platform integrations

## Development

### Requirements

- Node.js >= 24
- npm
- Git

### Installation

```bash
npm install
```

### Type checking

```bash
npm run typecheck
```

## License

MIT
