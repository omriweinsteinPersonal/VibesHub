FROM node:24-alpine AS build
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.20.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @vibeshub/worker... build
RUN pnpm deploy --filter @vibeshub/worker --prod /release

FROM node:24-alpine AS runtime
ENV HOST=0.0.0.0
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app
COPY --from=build /release ./
EXPOSE 8080
USER node
CMD ["node", "dist/main.js"]
