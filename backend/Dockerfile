FROM python:3.11-slim

WORKDIR /app

# Copiar requirements e instalar dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fuente
RUN mkdir -p /app/backend
# Copiamos el contenido del contexto (este Dockerfile se construye con context: ./backend)
# dentro de /app/backend para que el paquete `backend` exista en /app/backend
COPY . /app/backend

# Asegurar que Python pueda importar el paquete `backend` desde /app
ENV PYTHONPATH=/app

# Exponer puerto
EXPOSE 8001

# Copiar entrypoint y dar permisos
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Comando de inicio (entrypoint runs migrations/validator then starts app)
ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "backend.server:app", "--host", "0.0.0.0", "--port", "8001"]
