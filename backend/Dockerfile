# Build from the GitOps-App root:  docker build -f backend/Dockerfile -t backend .
FROM node:22-alpine AS deps
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine
ARG APP_VERSION=1.0.0
ENV NODE_ENV=production \
    PORT=3000 \
    APP_VERSION=${APP_VERSION}
# The runtime only needs `node`. Strip the package managers bundled in the base
# image (npm, corepack, yarn) — they are unused and carry their own CVEs
# (e.g. npm's bundled pacote) that fail the Trivy gate.
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx \
           /usr/local/bin/corepack \
           /opt/yarn-v* /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node backend/package.json ./
COPY --chown=node:node backend/src ./src
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:${PORT}/healthz || exit 1
CMD ["node", "src/server.js"]
