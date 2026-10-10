# Just recipes for nostr.com (SvelteKit + Electron + Capacitor)
# Run `just` to list recipes.

set dotenv-load := true

export NODE_VERSION := "22"
export ACT_WORKFLOW := ".github/workflows/ci.yml"
export ACT_ARCH := env_var_or_default("ACT_ARCH", "linux/amd64")

# Default: list all recipes
default:
    @just --list

# Install dependencies
install:
    npm ci

# Start Vite dev server
dev:
    npm run dev

# Build the static site
build:
    npm run build

# Preview the built site
preview:
    npm run preview

# Run Svelte + TypeScript checks
check:
    npm run check

# Run the Vitest test suite
test:
    npm test

# Generate app icons from source
icons:
    npm run icons

# Build Electron DMG for macOS (universal binary)
desktop-mac:
    npm run desktop:mac

# Build Electron DMG for macOS (Apple Silicon)
desktop-mac-arm64:
    npm run desktop:mac:arm64

# Build Electron DMG for macOS (Intel)
desktop-mac-x64:
    npm run desktop:mac:x64

# Build Electron AppImage for Linux
desktop-linux:
    npm run desktop:linux

# Build Electron NSIS installer for Windows
desktop-win:
    npm run desktop:win

# Build all desktop targets
desktop-all: desktop-mac desktop-linux desktop-win

# Capacitor sync for mobile builds
cap-sync:
    npm run cap:sync

# Run CI workflow locally with act (works on Apple Silicon with --container-architecture)
act-ci:
    act -W {{ACT_WORKFLOW}} --container-architecture {{ACT_ARCH}}

# Run CI workflow locally with verbose act output
act-ci-verbose:
    act -v -W {{ACT_WORKFLOW}} --container-architecture {{ACT_ARCH}}

# Run the full local validation that CI runs
ci: check test
