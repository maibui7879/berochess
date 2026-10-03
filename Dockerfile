# ---- build: full deps (incl. devDeps for Nest + engine compile) ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/xiangqi-engine/package.json ./packages/xiangqi-engine/package.json
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

# ---- runtime: prod deps + compiled output only ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/packages ./packages
EXPOSE 3000
CMD ["node", "dist/main"]
