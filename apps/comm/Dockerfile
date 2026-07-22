# Build depuis la RACINE du monorepo :  docker build -f apps/comm/Dockerfile .
FROM node:22-slim AS build
WORKDIR /repo
# Manifests d'abord (cache des deps tant qu'ils ne changent pas)
COPY package.json package-lock.json ./
COPY tsconfig.base.json tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/core-security/package.json ./packages/core-security/
COPY apps/comm/package.json ./apps/comm/
RUN npm ci
# Sources + build (tsc -b gère l'ordre des dépendances)
COPY packages ./packages
COPY apps/comm ./apps/comm
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production
# TODO : slim runtime (élaguer les devDeps) une fois le flux validé
COPY --from=build /repo ./
WORKDIR /repo/apps/comm
EXPOSE 3000
CMD ["node", "dist/index.js"]
