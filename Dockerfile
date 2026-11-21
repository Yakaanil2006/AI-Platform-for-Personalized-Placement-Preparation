FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt requirements-live.txt ./
ARG INSTALL_LIVE=true
RUN if [ "$INSTALL_LIVE" = "true" ]; then \
      pip install --no-cache-dir -r requirements-live.txt; \
    else pip install --no-cache-dir -r requirements.txt; fi
COPY backend/ backend/
COPY alembic.ini ./
COPY migrations/ migrations/
COPY --from=frontend /build/dist frontend/dist/
RUN useradd --create-home --uid 10001 appuser && mkdir /data && chown appuser:appuser /data
ENV HF_HOME=/opt/models HF_HUB_DISABLE_XET=1
RUN mkdir -p /opt/models && chown appuser:appuser /opt/models
USER appuser
RUN if [ "$INSTALL_LIVE" = "true" ]; then python -c "from backend.embeddings import model_files; model_files()"; fi
ENV DEMO_DATABASE_URL=sqlite:////data/demo.sqlite3
EXPOSE 8000
CMD ["sh", "-c", "exec python -m uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
