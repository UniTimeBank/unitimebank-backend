# ==============================================================================
# UniTime Bank Backend - Production Multi-Stage Dockerfile
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Builder
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install basic build tools
RUN apk add --no-cache python3 make g++

# Install dependencies with exact lockfile
COPY package*.json ./
RUN npm ci

# Copy full repository source
COPY . .

# Build all 9 NestJS microservices and libraries into /app/dist
RUN npx nest build api-gateway && \
    npx nest build auth && \
    npx nest build user && \
    npx nest build post && \
    npx nest build booking && \
    npx nest build session && \
    npx nest build wallet && \
    npx nest build moderation && \
    npx nest build notification

# ------------------------------------------------------------------------------
# Stage 2: Production Runner
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install curl for container healthchecks
RUN apk add --no-cache curl

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled javascript files from builder stage
COPY --from=builder /app/dist ./dist

# Create a non-root user for security
USER node

# Default entrypoint (Overridden by docker-compose for each microservice)
CMD ["node", "dist/apps/api-gateway/main.js"]
