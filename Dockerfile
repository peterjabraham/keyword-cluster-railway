FROM node:20-slim

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN npm --prefix frontend install

COPY frontend ./frontend
RUN npm --prefix frontend run build

EXPOSE 3000
CMD ["sh", "-c", "npm --prefix frontend run preview -- --host 0.0.0.0 --port ${PORT:-3000}"]
