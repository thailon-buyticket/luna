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

COPY --from=build /app/.mastra/output ./

EXPOSE 4111
CMD ["node", "index.mjs"]
