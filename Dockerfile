FROM node:20-bookworm-slim

WORKDIR /app

# Install build tools for native addons (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy backend dependencies
COPY package*.json ./
RUN npm install

# Copy frontend dependencies and build
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# Copy all repository files
COPY . .

# Build frontend & sync official Rome Mobilità GTFS database
RUN cd frontend && npm run build
RUN npm run sync-gtfs

ENV PORT=10000
EXPOSE 10000

CMD ["npm", "start"]
