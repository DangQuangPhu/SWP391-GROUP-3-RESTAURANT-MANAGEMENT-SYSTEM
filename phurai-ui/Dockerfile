# Stage 1: Build the frontend
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package configuration files
COPY package*.json ./

# Install all dependencies (including devDependencies required for Vite build)
RUN npm install

# Copy the entire workspace files
COPY . .

# Set Vite build-time environment variables with default values
ARG VITE_API_BASE_URL=/api
ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=""
ARG VITE_GOOGLE_CLIENT_ID=909445481908-0773rhu0gq39sbhf5mkriin0di4h9pnp.apps.googleusercontent.com

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# Build the frontend assets (outputs to /app/dist)
RUN npm run build

# Stage 2: Production Runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm install --production

# Copy backend codebase
COPY backend/ ./backend/

# Copy built frontend assets from the builder stage
COPY --from=builder /app/dist ./dist

# Expose backend API and websocket port
EXPOSE 5001

# Start the Express server
CMD ["node", "backend/src/index.js"]
