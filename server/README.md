# Reflect AI summary server

## Environment

Copy `.env.example` to `.env` on the server and set `OPENAI_API_KEY`. Never commit
the `.env` file or paste a key into the mobile app.

## Weekly AI reflection (hackathon mode)

`POST /weekly-summary` accepts up to 30 journal entries from the preceding week and
returns a structured, non-clinical reflection. The route is intentionally public for
the demo so no secret is embedded in the mobile app. It is rate-limited in memory to
six requests per client per hour and does not persist request data.

Before a production launch, replace this with per-user authentication, durable shared
rate limiting, and restricted CORS origins.
