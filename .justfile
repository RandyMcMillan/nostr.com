# Nostr Social — common development commands

# Default recipe: type-check and test
@default:
    just check-test

# Run the Svelte dev server
@dev:
    npm run dev

# Generate icons for web, Electron and Capacitor
@icons:
    npm run icons

# Build the production site
@build:
    npm run build

# Preview the production build
@preview:
    npm run preview

# Type-check the Svelte/TypeScript code
@check:
    npm run check

# Run the test suite
@test:
    npm test

# Run type checks and tests (same as CI)
@check-test:
    npm run check && npm test

# Build desktop apps
@desktop-mac:
    npm run desktop:mac

@desktop-mac-x64:
    npm run desktop:mac:x64

@desktop-mac-arm64:
    npm run desktop:mac:arm64

@desktop-linux:
    npm run desktop:linux

@desktop-win:
    npm run desktop:win

# Run the CI workflow locally with act
@act-ci:
    act -W .github/workflows/ci.yml

# Run the CI workflow locally on Apple Silicon (force amd64 container)
@act-ci-amd64:
    act -W .github/workflows/ci.yml --container-architecture linux/amd64

# Clean install dependencies
@ci:
    npm ci
