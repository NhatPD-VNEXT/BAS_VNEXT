# AGENTS.md

## Overview

This is a monorepo containing 7 independent SAP Fiori UI5 applications (plus 2 empty placeholder directories `zrap100`, `zsb_poc02_01`). All apps are frontend-only and connect to a remote SAP S/4HANA Cloud backend. There is no root `package.json`; each app is self-contained with its own `package.json`.

### Active apps

| Directory | OData Version | Template |
|---|---|---|
| `demo_extend` | v4 | List Report Page |
| `zdemo_link` | v4 | List Report Page |
| `zdemo_navigation` | v4 | List Report Page |
| `zse16n` | v2 | Basic (Freestyle) |
| `zsb_u2_se16n` | v2 | Basic (Freestyle) |
| `zsb_u4_demo` | v4 | List Report Page |
| `zsb_u4_demo_page` | v4 | Flexible Programming Model |

## Cursor Cloud specific instructions

### Running apps

Each app runs independently. Since the SAP S/4HANA Cloud backend (`my422346.s4hana.cloud.sap`) is not accessible from this environment, always use **mock mode**:

```bash
cd <app-directory>
npm run start-mock
```

The mock server uses `ui5-mock.yaml` config and serves generated mock data via `@sap-ux/ui5-middleware-fe-mockserver`. The dev server defaults to port 8080 and serves the app at `/test/flp.html#app-preview`.

### Building

```bash
cd <app-directory>
npm run build
```

Build output goes to `dist/` in each app directory.

### Linting / Testing

No ESLint or linting tools are configured in this repository. Integration tests (OPA5) are available via `npm run int-test` in each app directory (runs in mock mode). Two apps (`zse16n`, `zsb_u2_se16n`) also have `npm run unit-test`.

### Key caveats

- The `fiori run` server binds to `127.0.0.1` only (IPv4). Use `http://localhost:8080` not `http://[::1]:8080`.
- On first start, the backend proxy middleware logs errors about missing `.fioritools/systems.json` and credentials. These are safe to ignore in mock mode as the mock server middleware intercepts OData requests before they reach the proxy.
- UI5 libraries are loaded from `https://ui5.sap.com` CDN at runtime; initial page load may take 10-20 seconds.
- There is no root-level `package.json` or monorepo tooling. Dependencies must be installed per-app.
