<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Pravidla projektu

- Před každým `git push` spusť `npm run check` (tsc + testy + build). Když neprojde, nepushuj.
- Všechno, co přichází z klienta (route handlery, server actions, query parametry), validuj přes zod schémata v `lib/schemata.ts`. Žádné ruční `typeof` kontroly.
- Jednotkové testy: `lib/*.test.ts`, `node --test` (Node stripuje typy nativně, relativní importy v `lib/` proto mají příponu `.ts`).
