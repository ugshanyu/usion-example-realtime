FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY server.js ./
COPY server/ ./server/

ENV NODE_ENV=production
ENV PORT=3004

EXPOSE 3004

CMD ["node", "server.js"]
