FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json /app/server.js ./
RUN mkdir -p museum-data/uploads && chown -R node:node /app
USER node
EXPOSE 3000
VOLUME ["/app/museum-data"]
CMD ["npm", "start"]
