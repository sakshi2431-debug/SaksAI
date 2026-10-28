# SaksAI portfolio chatbot

Portfolio content lives in `portfolio-knowledge/*.md`. Run `npm run sync-kb` after editing it; this generates the Worker's knowledge module from those same files. `prebuild` and the Worker's `predeploy` do this automatically, so the two content sources no longer drift.

The Next.js chat route summarizes matching reviewed documents locally. The Cloudflare Worker uses matching documents as context for an LLM. Provider results are not proof of the underlying career claims.

## Local checks

Run `npm ci`, `npm test`, and `npm run build`. Tests use mocked providers, never live credentials or personal database records. The old Hello World scaffold tests were removed because they did not test this application.

## Configuration and safe deployment

Copy `.env.example` to an untracked environment file. Store Worker values as Cloudflare secrets, not source files. Use a publishable Supabase key (`SUPABASE_PUBLISHABLE_KEY`) or a legacy anon key (`SUPABASE_ANON_KEY`) for public search. Runtime handlers reject service-role credentials and do not log retrieved records or upstream error bodies.

Database fallback is **disabled by default**. Before setting `SUPABASE_SEARCH_ENABLED=true`, review the actual database schema, grants, RLS policies, and `search_documents` RPC. The RPC must not bypass those policies through an unsafe SECURITY DEFINER function. Grant public callers only the intended published portfolio content, with no insert, update, or delete capability. Re-index the corrected content and verify both read access and denied writes. Those live database checks have not been performed in this repair.

Administrative indexing scripts have different privileges: keep their keys in a separate local environment, never in the public Worker. Running them changes the database and may incur provider charges; they are not part of builds or tests. No database sync or deployment was performed here. Add appropriate platform rate controls before enabling a public paid-model endpoint; CORS is not authentication.

## Credential incident — October 2026

A past commit contains an OpenAI key and a Supabase service-role credential. The owner confirmed revoking/rotating both on October 27, 2026. Their validity was not tested and no secret value is reproduced here. Verify the old legacy Supabase credential is disabled: issuing a new publishable key alone does not revoke old service-role JWTs.

The repair stops tracking generated `.next` output and ignores environment files and Worker local secrets. **It does not rewrite existing Git history.** Coordinate a separate history purge with any collaborators after credentials are revoked; use a reviewed backup and account for forks/cached copies. Local deletion or a new commit does not remove old credentials from history.

## Career-claim corrections

- Amazon Music: Fine-Tuned Award, one of three named awards among 14 teams; team of four. Faculty judged the challenge. No first-place or executive-judging claim.
- ERbuddy: Design Lead on a team of three; research/design deliverable and client intent, not confirmed release or production impact.
- SVA: eye tracking belongs to the research-guides study, not ERbuddy. Conflicting task-success percentages are omitted pending measurement records.
- Jio: describe contributions to features rather than ownership of the whole platform. Conflicting growth percentages and unverified research figures are omitted.

The external Framer portfolio, Google Docs resumes, and previously submitted applications are not modified by changes in this repository.
