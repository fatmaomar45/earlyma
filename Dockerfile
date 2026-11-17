# syntax=docker/dockerfile:1

# Build the static frontend.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Minimal runtime: the auth server is dependency-free and serves dist/ + /api.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    AUTH_DATA_DIR=/var/data
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
EXPOSE 3001
VOLUME ["/var/data"]
CMD ["node", "server/index.mjs"]