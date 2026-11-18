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
# 1.30 = current nginx stable branch (1.27 is end-of-life and gets no fixes)
FROM nginxinc/nginx-unprivileged:1.30-alpine
# Pull in OS security fixes released after the base image was built
USER root
RUN apk upgrade --no-cache
USER 101
ENV BACKEND_URL=http://backend:3000
COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
