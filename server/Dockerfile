FROM node:24-bookworm-slim
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY shared /app/shared
COPY server/src ./src
COPY server/migrations ./migrations
RUN mkdir -p /app/server/data && chown node:node /app/server/data
ENV HOST=0.0.0.0 PORT=3001
EXPOSE 3001
USER node
CMD ["npm","start"]
