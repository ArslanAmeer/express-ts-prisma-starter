# Base stage with pnpm setup
FROM node:24.21.0-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Corepack is no longer bundled with Node 25+, so install it explicitly
RUN npm install -g corepack@latest && corepack enable
WORKDIR /app

# Production dependencies stage
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Install only production dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile --ignore-scripts

# Build stage - install all dependencies and build
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Install all dependencies (including dev dependencies)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm run build

# Final stage - combine production dependencies and build output
FROM node:24.21.0-alpine AS runner
WORKDIR /app
# Express reads NODE_ENV directly: without it, it runs in development mode and returns
# stack traces in error responses. Set here (not in a shared stage) so the build stage
# still installs devDependencies.
ENV NODE_ENV=production
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# package.json's "type": "module" tells Node that dist/*.js is ESM
COPY --chown=node:node package.json ./

# Use the node user from the image
USER node

# Expose port 8080
EXPOSE 8080

# Reports unhealthy when the app or its database stops answering
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:${PORT:-8080}/health-check" || exit 1

# Start the server
CMD ["node", "dist/index.js"]
