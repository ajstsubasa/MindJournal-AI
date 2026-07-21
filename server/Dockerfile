FROM node:20-bookworm-slim AS web

WORKDIR /web
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npx expo export --platform web --output-dir dist

FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app
COPY server/ .
RUN uv sync

COPY --from=web /web/dist ./web

EXPOSE 80

CMD ["uv", "run", "main.py"]
