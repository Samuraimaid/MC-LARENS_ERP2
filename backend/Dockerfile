FROM mongo:7.0 AS mongo-tools
FROM python:3.11-slim

WORKDIR /app

# Copiar requirements e instalar dependencias
COPY requirements.txt .
RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-dejavu-core bash tar gzip libjpeg62-turbo zlib1g \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir -r requirements.txt

COPY --from=mongo-tools /usr/bin/mongodump /usr/bin/mongodump
COPY --from=mongo-tools /usr/bin/mongorestore /usr/bin/mongorestore

# Copiar código fuente
RUN mkdir -p /app/backend
# Copiamos el contenido del contexto (este Dockerfile se construye con context: ./backend)
# dentro de /app/backend para que el paquete `backend` exista en /app/backend
COPY . /app/backend

# Asegurar que Python pueda importar el paquete `backend` desde /app
ENV PYTHONPATH=/app

# Exponer puerto
EXPOSE 8001

# Healthcheck para políticas Docker / depends_on
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/api/', timeout=5)" || exit 1

# Copiar entrypoint y dar permisos
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
    && chmod +x /app/backend/scripts/backup_server_node.sh \
    && mkdir -p /app/uploads /app/uploads/deliveries /app/backups /mnt/usb_backup

# Comando de inicio (entrypoint runs migrations/validator then starts app)
ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "backend.server:app", "--host", "0.0.0.0", "--port", "8001"]
