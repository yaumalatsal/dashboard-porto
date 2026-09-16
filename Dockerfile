# Dashboard: zero-runtime-dependency Node.js monitoring app.
# Uses ONLY Node.js built-in modules (http, https, fs, path, url).
# No npm install needed in the image.
FROM node:22-alpine

WORKDIR /app

# Copy application source
COPY package.json ./
COPY server.js ./
COPY sites.json.example ./

# Copy static assets (UI served by the app)
COPY public/ ./public/

# Copy entrypoint (generates sites.json at boot)
COPY docker/entrypoint.sh /usr/local/bin/entrypoint

# Create non-root user
RUN addgroup -S dashboard && \
    adduser -S dashboard -G dashboard && \
    chown -R dashboard:dashboard /app && \
    chmod +x /usr/local/bin/entrypoint

USER dashboard

EXPOSE 3001
ENTRYPOINT ["entrypoint"]
CMD ["node", "server.js"]
