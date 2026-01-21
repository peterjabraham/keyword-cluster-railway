FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
COPY frontend/package.json frontend/package-lock.json* ./frontend/
COPY server/package.json server/package-lock.json* ./server/
RUN npm install

COPY frontend ./frontend
COPY server ./server

RUN npm --workspace frontend run build

EXPOSE 3000
CMD ["npm", "--workspace", "server", "run", "start"]
