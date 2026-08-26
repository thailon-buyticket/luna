# Build stage: installs deps with Bun (matches bun.lock) and runs `mastra build`,
# which bundles the app and does its own `npm install` into .mastra/output.
FROM oven/bun:1-slim AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Runtime stage: the .mastra/output directory is a self-contained Node server,
# so the final image only needs Node, not Bun.
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build --chown=node:node /app/.mastra/output ./
ENV MASTRA_STUDIO_PATH=./studio

USER node

EXPOSE 4111

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4111/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "index.mjs"]
