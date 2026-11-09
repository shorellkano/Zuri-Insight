FROM node:24-bookworm-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate
COPY . .
RUN node --version && pnpm --version && pnpm install --frozen-lockfile --prod=false
RUN pnpm run build
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
USER node
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
