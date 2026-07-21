# Reflect AI summary server

## Environment

Copy `.env.example` to `.env` on the server and set `OPENAI_API_KEY`. Never commit
the `.env` file or paste a key into the mobile app. The server uses this key internally;
the mobile app does not need a key.

## App AI routes

`POST /summarize` and `POST /concepts` are the primary app routes. They do not retain
request data and use the server's OpenAI key internally. They are public for the hackathon
demo; add user authentication and durable rate limiting before a production launch.

## Weekly AI reflection (hackathon mode)

`POST /weekly-summary` accepts up to 30 journal entries from the preceding week and
returns a structured, non-clinical reflection. It remains a rate-limited backup route
for the demo and does not persist request data.

Before a production launch, replace this with per-user authentication, durable shared
rate limiting, and restricted CORS origins.
