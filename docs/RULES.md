# 📜 AI Collaboration Rules

---

## ⚠️ MANDATORY RULES (Always Enforced)

- **Always aim for best practices.** Always aim for best practices by following the official documentation and widely accepted community standards for the libraries and frameworks in use.
- **Prioritize safety and security.**
- Validate and sanitize all external inputs to prevent common vulnerabilities (e.g., XSS, SQL injection, command injection, path traversal).
- Handle edge cases, and avoid insecure code patterns like eval() or direct DOM manipulation without sanitization.
- Never log sensitive user data. Ensure that credentials, API keys, and Personally Identifiable Information (PII) are never exposed in logs, client-side code, or version control.
- Use secure defaults for configurations (e.g., HTTPS over HTTP, secure cookies).
- For third-party integrations, verify API responses and implement rate limiting to prevent abuse.
- **Never modify dependencies manually.** All changes to `package.json` or lock files must go through a package manager (`bun`, `npm`, or `pnpm`).

---

## 1. Code Structure & Design

- **Modular design**  
  Always aim for small, focused files. If a file starts growing too large or becomes difficult to follow, split it into multiple modules. This makes the codebase easier to maintain and reduces complexity.
- **Adhere to SOLID principles**
  - Ensure each module, class, or function has a single responsibility to avoid god-objects.
  - Design for extension without modification (e.g., use interfaces for extensibility).
  - This reduces coupling, improves testability, and aligns with modular design.

- **No duplication**  
  Reuse logic, types, or utilities whenever possible. Duplicate code creates maintenance risk and inconsistency.  

- **Error handling**  
  Every function, API endpoint, or async operation must include basic error handling (e.g., try/catch) with meaningful error messages that help diagnose issues.  

- **Performance awareness**
  - Prioritize readability first, but avoid naive or obviously inefficient solutions.
  - Flag potential bottlenecks (e.g., O(n²) loops, blocking I/O inside loops) and suggest optimizations or async patterns when scalability could become an issue.
  - Keep Cloudflare Pages bundle size in mind for frontend changes:
    - avoid unnecessary heavy dependencies in client bundles
    - prefer code splitting/lazy loading for non-critical UI
    - remove unused code and imports
    - treat bundle-size reduction as an ongoing optimization goal, even when not yet a hard CI gate

---

## 2. Code Quality & Consistency

### 2.1 Naming, Linting & Formatting

- **Naming conventions**
  - Variables/functions → `camelCase`
  - Components/classes → `PascalCase`
  - Constants → `SCREAMING_SNAKE_CASE`
  - Files → kebab-case (e.g., `user-profile.service.ts`) or PascalCase for components (e.g., `UserProfile.tsx`)
  - Handle acronyms consistently → Treat them as single words (e.g., `urlParser` not `uRLParser`).

- **Linting and formatting**  
  All code must pass linting and formatting checks.  
  No commit should bypass test, linting or TypeScript rule violations.

---

### 2.2 Type Safety & Dependencies

- **Type safety**
  - Strong typing is required for all code. Avoid `any` unless absolutely necessary and justify its use with a comment.
  - Do not duplicate type definitions—always reuse or extend existing types. Use utility types like `Pick`, `Omit`, and `Partial` to derive new types from existing ones.
  - All types must be imported from the same project’s general types directory.

- **Dependency Management**
  - Add dependencies only when necessary.
  - Use specific version ranges (e.g., ^ for patch/minor updates) and pin critical dependencies.
  - Run a security audit (e.g., `npm audit`, `bun audit`) to check for known vulnerabilities.

---

### 2.3 Clean Code & Repo Hygiene

- **Clean Code**
  - Do not leave temporary scripts, experiments, unused files, dead code (unreachable functions/variables), or commented-out code blocks.
  - Group related scripts in a dedicated subdirectory, keeping /scripts clean and organized.

### 2.4 Responsive UI

- All user-facing pages must work at 360px, 375px, 390px, and 414px widths, and desktop.
- No page-level horizontal scrolling. Tables may scroll horizontally inside their own container/card.
- Navigation must be usable on mobile (for example, mobile nav, drawer, or equivalent pattern).
- Charts must be responsive to their container and must not overflow or get cut off.
- UI pull requests must include at least one mobile screenshot and one desktop screenshot.

---

## 3. Testing & Validation

- **Commit validation**
  - Pre-commit hooks must run
  - `lint`, `type-check`, `unit`, and `e2e` tests.
  - Never bypass with `--no-verify`.
  - If a test fails, fix the code—not the test—unless the test itself is flawed or the underlying requirement it validates has changed.

- **AI staged review gate (mandatory)**
  - Install/update local hooks by running `./scripts/setup.sh` once per clone.
  - Before every commit, use the Codex CLI to request a review of the currently staged files.
  - Provide this review context to the agent:
    - `git diff --staged` (or equivalent staged-file view)
    - `docs/RULES.md`
    - `docs/TECH_STACK.md`
    - `README.md`
    - `docs/AGENTS.md`
  - Use your installed Codex CLI invocation and include this minimum instruction:
    - "Review the staged git changes using docs/RULES.md, docs/TECH_STACK.md, README.md, and docs/AGENTS.md as constraints. Flag bugs, regressions, security risks, missing tests, and workflow/architecture violations. Return only required fixes."
  - All required feedback from this review must be applied before committing.
  - Do not commit while required feedback is still unresolved.

---

## 4. Workflow Discipline

### 4.1 Commits & Branching

- **Small, focused commits**  
  Each commit should represent a single, logical change. Avoid mixing unrelated fixes, features, or refactors in one commit.  

- **Commit messages**  
  Write clear and descriptive commit messages following the Conventional Commits style (`feat:`, `fix:`, `chore:`, `test:`). Messages should explain what changed and why.  

- **Branching strategy**  
  Never commit directly to `main`. All work should be done in branches and merged through pull requests, even if written by AI.

---

### 4.2 Task Management & Documentation

- **Task focus**  
  Work on one clearly defined task or ticket at a time. Do not spread changes across multiple features or modules unless explicitly related.  

- **Documentation**
  - Update inline comments and project documentation as new functions, components, or configurations are added. Use JSDoc format for functions and types to enable auto-generation.
  - More complex logic should have its own file in the `/docs` directory.
  - Any logic that changes how the user executes the main or any of the scripts MUST update the `README` file with a usage explanation.

---

## 5. AI-Specific Guardrails

### 5.1 Behavior & Responsibility

- **No hallucinations** Only suggest or write APIs, libraries, or functions that exist. If an external dependency is proposed, verify its existence and include a reference link.  

- **No silent assumptions**. If the requirements are unclear, ask questions instead of guessing.  

- **No workarounds**. Only recommended solutions. Do not fake a function to pass a test.  

- **Respect project patterns**. Follow the existing style, folder structure, and conventions already present in the codebase.  

- **No unnecessary refactors.** Avoid rewriting large parts of the project unless explicitly requested. Focus on incremental, targeted improvements.

- **Ethical coding**. Ensure accessibility (e.g., alt text for images, ARIA labels in UI).

---

## 6\. Technical Specifications

Use the latest stable version of the libraries when installing fresh. This is my desired stack:

- React19 for frontend framework.
  - Typescript is a must.
  - Tailwindcss for styling.
  - ShadcnUI for the components. Every new component should use this library.
  - Either NextJS, Astro or TanStack depending on whether the project is mostly behind authentication (Tanstack) or mostly public facing (Next, great SEO, same SSR components for everyone) or if mostly static (Astro)..
  - Drizzle ORM. No migrations, DB schemas handled by version control and updated with db:push.
  - Zod for schema based validation in the requests.
  - SQLite for development to minimize dependencies but PSQL for production.
  - Better-Auth for authentication.
  - Environment variables managed via .env files with validation using Zod
