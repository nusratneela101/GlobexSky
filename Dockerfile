# Stage 1: Build static frontend assets
FROM node:20-alpine AS builder
WORKDIR /app
# Copy only what's needed for any potential build steps
COPY package*.json ./
RUN npm install --ignore-scripts 2>/dev/null || true
COPY . .

# Stage 2: Serve with nginx
FROM nginx:alpine
# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf
# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf
# Copy static frontend files
COPY --from=builder /app/index.html /usr/share/nginx/html/
COPY --from=builder /app/assets /usr/share/nginx/html/assets
COPY --from=builder /app/pages /usr/share/nginx/html/pages
COPY --from=builder /app/js /usr/share/nginx/html/js
COPY --from=builder /app/locales /usr/share/nginx/html/locales
COPY --from=builder /app/manifest.json /usr/share/nginx/html/
COPY --from=builder /app/sw.js /usr/share/nginx/html/
COPY --from=builder /app/robots.txt /usr/share/nginx/html/
COPY --from=builder /app/sitemap.xml /usr/share/nginx/html/
# Expose port 80
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
