# Build from the GitOps-App root:  docker build -f frontend/Dockerfile -t frontend .
FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ARG APP_VERSION=1.0.0
ENV VITE_APP_VERSION=${APP_VERSION}
RUN npm run build

# Runs as non-root (uid 101) and listens on 8080
# Pin an exact nginx + Alpine version: the floating "1.27-alpine" tag had drifted
# to nginx 1.30.6, which has CRITICAL/HIGH CVEs (fixed in >= 1.30.7).
FROM nginxinc/nginx-unprivileged:1.31.7-alpine3.24
# Pull in the latest Alpine security patches, then drop back to the non-root user.
USER root
RUN apk upgrade --no-cache
USER 101
ENV BACKEND_URL=http://backend:3000
COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
