# --- Build Stage ---
FROM node:20-slim AS build

WORKDIR /app

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY frontend/ .

# Build the project
RUN npm run build

# --- Serve Stage ---
FROM nginx:alpine

# Copy the build output from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Custom nginx config to handle Cloud Run's $PORT
RUN printf "server {\n\
    listen 8080;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html index.htm;\n\
        try_files \$uri \$uri/ /index.html;\n\
    }\n\
}\n" > /etc/nginx/conf.d/default.conf

# We use a script to replace the port at runtime
# Cloud Run injects $PORT environment variable
CMD ["sh", "-c", "sed -i 's/listen 8080;/listen '${PORT:-8080}';/' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
