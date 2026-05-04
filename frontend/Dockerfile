FROM node:20-alpine AS build

WORKDIR /app

# Copiar package.json y package-lock
COPY package*.json ./

# Instalar dependencias con el lockfile actual
RUN npm ci

# Copiar código fuente y construir
COPY . .

# Pasar variables de entorno opcionales al build
ARG VITE_BACKEND_URL
ARG VITE_AUTH_URL
ARG VITE_ATTENDANCE_KIOSK_SHORTCUT_PIN
ARG VITE_APP_VERSION
ARG VITE_APP_BUILD_TIME
ARG VITE_APP_BUILD_ID
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
ENV VITE_AUTH_URL=${VITE_AUTH_URL}
ENV VITE_ATTENDANCE_KIOSK_SHORTCUT_PIN=${VITE_ATTENDANCE_KIOSK_SHORTCUT_PIN}
ENV VITE_APP_VERSION=${VITE_APP_VERSION}
ENV VITE_APP_BUILD_TIME=${VITE_APP_BUILD_TIME}
ENV VITE_APP_BUILD_ID=${VITE_APP_BUILD_ID}

RUN npm run build

FROM nginx:alpine

# Copiar build estático desde la etapa de build
COPY --from=build /app/build /usr/share/nginx/html

# Copiar configuración de nginx (si existe en el contexto)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
