FROM node:20-alpine AS base

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN mkdir -p public
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080

WORKDIR /app

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.js ./next.config.js

USER nextjs
EXPOSE 8080

CMD ["sh", "-c", "npm run start -- -H 0.0.0.0 -p ${PORT:-8080}"]
