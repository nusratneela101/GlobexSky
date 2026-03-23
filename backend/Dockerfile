FROM node:20-alpine

# Install curl for health check
RUN apk add --no-cache curl

# Create app directory
WORKDIR /app

# Copy package files and install dependencies
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy backend source code
COPY backend/ .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 && \
    chown -R nodeuser:nodejs /app
USER nodeuser

# Expose backend port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Start the application
CMD ["node", "backend/server.js"]
