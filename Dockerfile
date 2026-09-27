FROM node:20-bookworm-slim

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy root and service package files
COPY package.json ./
COPY server/package*.json ./server/
COPY admin-dashboard/package*.json ./admin-dashboard/
COPY resident-app/package*.json ./resident-app/

# Install dependencies for all services
RUN cd server && npm install --omit=dev
RUN cd admin-dashboard && npm install
RUN cd resident-app && npm install

# Copy complete project source
COPY . .

# Build production frontends
RUN npm --prefix admin-dashboard run build
RUN npm --prefix resident-app run build

# Ensure database directory exists
RUN mkdir -p /app/server/data

# Environment configuration
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Start the unified EcoVoltX platform
CMD ["npm", "start"]
