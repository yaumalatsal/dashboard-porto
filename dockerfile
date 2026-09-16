# syntax=docker/dockerfile:1

# Node 24: the console's storage layer uses the built-in `node:sqlite` module,
# which is only available without a flag from Node 23.4 onward. Staying on 20
# would mean adding a native SQLite dependency and a build toolchain to the
# image, which is exactly what this design avoids.
FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 2. Dependency installation stage
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# 3. Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# The poller must not run during `next build` — it would start polling
# production endpoints from the build machine and write a throwaway database.
ENV CONSOLE_DISABLE_POLLER=1

RUN npm run build

# 4. Production runtime stage (minimal footprint & non-root user)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

RUN mkdir .next
RUN chown nextjs:nodejs .next

# Next.js standalone output keeps the image small.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# The committed seed registry. On first boot the app copies it onto the data
# volume; thereafter the volume's copy is authoritative and survives redeploys.
COPY --from=builder --chown=nextjs:nodejs /app/sites.json.example ./

# SQLite lives here and is expected to be a mounted volume, so history survives
# `docker compose up --build`.
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data
VOLUME ["/app/data"]

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV CONSOLE_DATA_DIR=/app/data
# The registry lives beside the database on the volume, so apps added through
# the console are not lost on the next deploy.
ENV CONSOLE_SITES_PATH=/app/data/sites.json

CMD ["node", "server.js"]
