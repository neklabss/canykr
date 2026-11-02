# syntax=docker/dockerfile:1.7
# Builds apps/web or apps/admin (Next.js standalone output).
ARG APP=web
FROM node:22-bookworm-slim AS build
ARG APP
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter "@backupjam/${APP}..." build

FROM node:22-bookworm-slim
ARG APP
ARG PORT=3000
ENV NODE_ENV=production PORT=$PORT HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build /repo/apps/${APP}/.next/standalone ./
COPY --from=build /repo/apps/${APP}/.next/static ./apps/${APP}/.next/static
RUN ln -s /app/apps/${APP}/server.js /app/server.js
USER node
EXPOSE ${PORT}
CMD ["node", "server.js"]
