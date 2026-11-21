# Pin the image digest in your release policy; tags below track security updates.
FROM node:26-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
ARG VITE_PUBLIC_SITE_URL
ARG VITE_WHATSAPP_NUMBER
ARG VITE_COMMERCE_MODE=connected
ENV VITE_PUBLIC_SITE_URL=$VITE_PUBLIC_SITE_URL VITE_WHATSAPP_NUMBER=$VITE_WHATSAPP_NUMBER
ENV VITE_COMMERCE_MODE=$VITE_COMMERCE_MODE
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:26-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 UPLOAD_DIR=/app/data/uploads
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/shared ./shared
COPY --from=build --chown=node:node /app/dist ./dist
RUN mkdir -p /app/data/uploads && chown -R node:node /app/data
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node server/scripts/healthcheck.js api
CMD ["node","server/index.js"]
