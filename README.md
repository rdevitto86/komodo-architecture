# Komodo Architecture

System architecture documentation for the Komodo platform — HLDs, LLDs, ADRs, and PRDs organized by domain and service.

Built with [Astro](https://astro.build) + [Svelte](https://svelte.dev). Diagrams rendered via Mermaid.

## Structure

```
hld/      High-level designs
lld/      Low-level designs
adr/      Architecture decision records
prd/      Product requirements
assets/   Shared images and static files
src/      App shell, layouts, and Svelte components
```

## Dev

```bash
node --version   # must be >= 26
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
pnpm preview
```
