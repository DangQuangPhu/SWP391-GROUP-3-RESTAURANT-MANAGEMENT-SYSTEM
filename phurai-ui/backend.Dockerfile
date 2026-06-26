FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY backend/ ./backend/

EXPOSE 5001

CMD ["node", "backend/src/index.js"]
