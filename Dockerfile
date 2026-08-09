# Single image: builds the frontend, then serves it from the backend.
# Base images are multi-arch, so this builds natively on Oracle's ARM Ampere.

FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app

# Production deps only.
COPY backend/package*.json ./backend/
RUN npm ci --omit=dev --prefix backend

COPY backend/ ./backend/
COPY --from=frontend /app/frontend/dist ./frontend/dist

# Don't run as root.
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

ENV NODE_ENV=production
ENV PORT=5001
EXPOSE 5001

# The container is unhealthy if the app stops answering, so the restart
# policy can act on it.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "backend/src/index.js"]
