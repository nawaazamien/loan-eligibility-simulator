# syntax=docker/dockerfile:1

# ---- Build stage: install from the lockfile and produce the static bundle ----
FROM node:24.18.0-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---- Runtime stage: static files only, served by unprivileged nginx ----
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

# The base image already runs as the non-root "nginx" user (uid 101).
USER 101
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
