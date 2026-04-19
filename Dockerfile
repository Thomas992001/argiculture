# --- Stage 1: Build Frontend ---
FROM node:20-slim AS frontend-build
WORKDIR /app
# Copy the entire project context so relative imports work
COPY . .
WORKDIR /app/frontend
# Install dependencies
RUN npm install
# Build the project -> creates frontend/dist
RUN npm run build


# --- Stage 2: Build & Serve Backend ---
FROM python:3.12-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire backend and project files
COPY . .

# Copy the compiled frontend code from Stage 1 into the backend container
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

ENV PYTHONUNBUFFERED=1
ENV PORT=8080

EXPOSE 8080

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
