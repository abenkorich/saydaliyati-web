FROM node:24.21.0-alpine AS build
WORKDIR /app
RUN npm install --global pnpm@11.24.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24.21.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
RUN addgroup -S -g 1001 portal && adduser -S -u 1001 -G portal portal
COPY --from=build --chown=portal:portal /app/.next/standalone ./
COPY --from=build --chown=portal:portal /app/.next/static ./.next/static
COPY --from=build --chown=portal:portal /app/public ./public
USER portal
EXPOSE 3000
CMD ["node", "server.js"]
