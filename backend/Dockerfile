# Build from the GitOps-App root:  docker build -f backend/Dockerfile -t backend .
FROM node:22-alpine AS deps
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine
# Pull in OS security fixes released after the base image was built
RUN apk upgrade --no-cache
ARG APP_VERSION=1.0.0
ENV NODE_ENV=production \
    PORT=3000 \
    APP_VERSION=${APP_VERSION}
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node backend/package.json ./
COPY --chown=node:node backend/src ./src
USER node
EXPOSE 5002
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:5002/healthz || exit 1
CMD ["node", "src/server.js"]
