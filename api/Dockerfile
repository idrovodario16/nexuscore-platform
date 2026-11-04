FROM node:22-alpine AS build
WORKDIR /app
COPY api/package*.json ./
RUN npm ci
COPY api/tsconfig.json ./
COPY api/src ./src
COPY api/test ./test
RUN npm run build && npm prune --omit=dev
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY api/package.json ./
COPY api/db ./db
COPY api/scripts ./scripts
COPY examples /examples
USER node
EXPOSE 3000
CMD ["sh","-c","npm run migrate && npm start"]
