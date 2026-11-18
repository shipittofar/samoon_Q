FROM node:22-alpine AS dev

WORKDIR /app

COPY package*.json ./

RUN npm ci

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["npm","run","dev"]

FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --frozen-lockfile

COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so
# they must be provided as build args — runtime `environment:` in compose
# only reaches server code. They must be URLs the end user's browser can
# reach (not internal Docker hostnames).
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_WS_BASE_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_MEDIA_BASE_URL
ARG NEXT_PUBLIC_ROOT_DOMAIN
ARG NEXT_PUBLIC_USE_MOCK=false
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL     NEXT_PUBLIC_WS_BASE_URL=$NEXT_PUBLIC_WS_BASE_URL     NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL     NEXT_PUBLIC_MEDIA_BASE_URL=$NEXT_PUBLIC_MEDIA_BASE_URL     NEXT_PUBLIC_ROOT_DOMAIN=$NEXT_PUBLIC_ROOT_DOMAIN     NEXT_PUBLIC_USE_MOCK=$NEXT_PUBLIC_USE_MOCK     NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY     NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build


FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
