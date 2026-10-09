# AI Agent Instructions for the Lightspeed Agentic Console Plugin

This document provides context and guidelines for AI coding assistants working on this codebase.

## Specs

All specifications live in `.ai/spec/`. Start with `.ai/spec/README.md` for project overview, reading order, and structure guide.

## Project Overview

This is the **OpenShift Lightspeed Agentic Console Plugin** — an OpenShift Console dynamic plugin for managing AI-driven cluster operation runs. Users view, approve/deny, and monitor runs through a multi-stage workflow (Analysis, Execution, Verification, Escalation) and configure approval policies.

Scope is the React frontend only: it renders run state (from `AgenticRun` custom resources) and sends approval/denial patches. Out of scope: the lightspeed-agentic-operator (reconciles runs), the agentic-sandbox (executes agent workloads), CRD definitions, and backend API logic.

**Key Technologies:**
- TypeScript + React 18
- PatternFly 6 (UI component library)
- Webpack 5 with Module Federation
- react-i18next for internationalization
- Vitest for unit tests, Playwright for e2e testing

**Compatibility:** Requires OpenShift 4.22+

## Architecture & Patterns

### Dynamic Plugin System

This plugin uses webpack module federation to load at runtime into the OpenShift Console. Key files:

- `console-extensions.json`: Declares what the plugin adds to console (routes, nav items, etc.)
- `package.json` `consolePlugin` section: Plugin metadata and exposed modules mapping
- `webpack.config.ts`: Configures module federation and build

**Critical:** Any component referenced in `console-extensions.json` must have a corresponding entry in `package.json` under `consolePlugin.exposedModules`.

### Styling Constraints

**IMPORTANT:** The `.stylelintrc.yaml` enforces strict rules to prevent breaking console:

- **NO hex colors** - use PatternFly CSS variables (e.g., `var(--pf-v6-global-palette--blue-500)`)
- **NO naked element selectors** (like `table`, `div`) - prevents overwriting console styles
- **NO `.pf-` or `.co-` prefixed classes** - these are reserved for PatternFly and console
- **Prefix all custom classes** with `ols-plugin__` (e.g., `ols-plugin__run-timeline`)

Don't disable these rules without understanding they protect against layout breakage!

## Internationalization (i18n)

**Namespace:** `plugin__lightspeed-agentic-console-plugin`

### In React Components:
```tsx
const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
return <h1>{t('Agentic runs')}</h1>;
```

### In console-extensions.json:
```json
"name": "%plugin__lightspeed-agentic-console-plugin~My Label%"
```

**After adding/changing messages:** Run `npm run i18n` to update locale files in `/locales`

## File Organization

```
src/
  components/          # React components (configuration/, runs/, shared)
  hooks/              # Custom hooks
  models/             # AgenticRun model and view helpers
  utils/              # Approval, RBAC, and markdown utilities
console-extensions.json # Plugin extension declarations
package.json           # Plugin metadata in consolePlugin section
tsconfig.json          # TypeScript config
webpack.config.ts      # Module federation + build config
locales/               # i18n translation files
integration-tests/     # Playwright e2e tests
```

## Development Workflow

### Local Development
1. `npm install` - install dependencies
2. `npm start` - starts webpack dev server on port 9001 with CORS
3. `npm run start-console` - runs OpenShift console in container (requires cluster login)
4. Navigate to http://localhost:9000/lightspeed/runs

### Code Quality
- `npm run lint` - checks eslint and stylelint (no auto-fix)
- `npm run lint-fix` - checks and auto-fixes eslint and stylelint issues
- `npm run type-check` - runs `tsc --noEmit`
- Linting is mandatory before commits
- Follow existing code patterns in the repo

### Testing
- `npm run test-unit` - runs unit tests (vitest)
- `npm run test-e2e` - runs Playwright tests
- `npm run test-e2e-headless` - runs Playwright tests with list reporter
- Add tests for new pages/features

## TypeScript Configuration

Config enforces:
- `strict: true`
- `noUnusedLocals: true`
- Use `.tsx` only for React components; non-React TypeScript (configuration, hooks, models, utilities, tests) uses `.ts`
- Target: ES2021

## Common Development Tasks

### Adding a New Page
1. Create component in `src/components/MyPage.tsx`
2. Add to `package.json` `exposedModules`: `"MyPage": "./components/MyPage"`
3. Add route in `console-extensions.json`:
   ```json
   {
     "type": "console.page/route",
     "properties": {
       "path": "/lightspeed/my-page",
       "component": { "$codeRef": "MyPage" }
     }
   }
   ```
4. Optional: Add nav item in `console-extensions.json`
5. Run `npm run i18n` if you added translatable strings

### Adding a Navigation Item
```json
{
  "type": "console.navigation/href",
  "properties": {
    "id": "my-nav-item",
    "name": "%plugin__lightspeed-agentic-console-plugin~My Page%",
    "href": "/lightspeed/my-page",
    "perspective": "admin",
    "section": "lightspeed-agentic-runs"
  }
}
```

### Updating Dependencies to Fix CVEs

For transitive dependencies (packages not listed in `package.json` under `dependencies` or
`devDependencies`):

- First try updating the lockfile without adding an override:
  `npm update <package> --package-lock-only --ignore-scripts`
- If the update does not resolve to a patched version, add an `overrides` entry in `package.json` to
  require one
- Review the `package-lock.json` diff and confirm the affected dependency resolves to a patched
  version. Sometimes there will be unrelated changes in the lockfile due to npm or Node.js version
  differences. In that case, remove the unrelated changes before committing.

## Build & Deployment

The release image is built in CI (Konflux) from the repo `Dockerfile`, which does a
production `npm run build` and serves the static `dist/` output via nginx. To build it
locally from the same `Dockerfile`:

```bash
docker build -f Dockerfile -t lightspeed-agentic-console:dev .
# For Apple Silicon: add --platform=linux/amd64
```

## Important Constraints & Gotchas

1. **Module federation requires exact module mapping** - `exposedModules` must match `$codeRef` values
2. **No webpack HMR for extensions** - changes to `console-extensions.json` require restart
3. **React 18** - matches console's React version

## Extension Points

See [Console Plugin SDK README](https://github.com/openshift/console/tree/master/frontend/packages/console-dynamic-plugin-sdk) for available extension types:

- `console.page/route` - add new pages
- `console.navigation/href` - add nav items
- `console.navigation/section` - add nav sections
- `console.tab` - add tabs to resource pages
- `console.action/provider` - add actions to resources
- `console.flag` - feature flags
- Many more...

## Code Style Preferences

- Functional components with hooks (NO classes)
- TypeScript for all new files
- Use PatternFly components whenever possible
- Keep components focused and composable
- Prefer named exports for components
- Use `React.FC` or explicit return types
- CSS-in-files (not CSS-in-JS)
- Use [sentence case](https://www.patternfly.org/ux-writing/capitalization/) for all titles,
  headings, and UI text (capitalize only the first word and proper nouns)

## Testing Strategy

- **Unit tests (Vitest):** Co-located `*.test.ts` files for utility and model logic
- **Component tests (Vitest + Testing Library):** Co-located `*.test.tsx` files for component behavior
- **E2E tests (Playwright):** For user flows and page rendering
- **Test data attributes:** Use `data-test` attributes for selectors
- Run tests locally before opening PRs

## References

- [Console Plugin SDK](https://github.com/openshift/console/tree/master/frontend/packages/console-dynamic-plugin-sdk)
- [PatternFly React](https://www.patternfly.org/get-started/develop)
- [Dynamic Plugin Enhancement Proposal](https://github.com/openshift/enhancements/blob/master/enhancements/console/dynamic-plugins.md)

## Git and PR Workflow

### Commit Messages
- Start with the Jira ticket reference: `OLS-XXXX description`
- Keep the first line under 72 characters
- Use imperative mood

### Pull Requests
This repo uses a **fork-based workflow**:

1. **Push to your fork**, not to `origin` (openshift/lightspeed-agentic-console)
2. **Create the PR** against `origin/main` using your fork's branch:
   ```bash
   git push <your-fork-remote> <branch>
   gh pr create --repo openshift/lightspeed-agentic-console --head <your-github-user>:<branch> --base main
   ```
3. **PR title** must start with the Jira reference: `OLS-XXXX description`
4. **Squash commits** before pushing
