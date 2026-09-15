# Moonline project context

Read HOME-HANDOFF.md and README.md before starting work. The original project name was 밤편지; preserve docs/ORIGINAL-PLAN.txt as source material.

- Expo SDK 54 / React Native app; Node.js 24. Root app is demo by default and requires no external accounts.
- Preserve warm reeded-glass design and clean system sans typography. Do not reintroduce handwriting fonts.
- Keep the existing local storage keys for compatibility with prior demo records.
- The user has no Twilio/OpenAI/Supabase accounts configured yet. Do not claim real phone calls, voice cloning, video, or payments work without integration and verification.
- Keep API keys, personal recordings, local databases, environment files, node_modules, and build artifacts out of Git. Only empty .env.example templates belong in the repository.
- Validate app changes with npm run typecheck and relevant npm test checks. For server changes also run npm --prefix server run typecheck and npm --prefix server test.
- Current UX changes and limitations are documented in docs/UX-UPDATE-2026-09-15.md. Custom voice direction is in docs/CUSTOM-VOICE.md.
