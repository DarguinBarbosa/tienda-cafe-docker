# Imagen propia del servidor web (Node.js + Express).
# Uso la variante Alpine porque pesa mucho menos que la imagen completa.
FROM node:22-alpine

LABEL org.opencontainers.image.title="tienda-cafe-web" \
      org.opencontainers.image.description="Servidor web Node.js de la Tienda de Café de Origen"

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# Copio primero solo los manifiestos de dependencias.
# Así Docker reutiliza esta capa en caché mientras no cambien las dependencias.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Luego copio el código de la aplicación
COPY src ./src
COPY views ./views
COPY public ./public

# No ejecuto el proceso como root dentro del contenedor
USER node

EXPOSE 3000

# Docker marca el contenedor como "healthy" solo si la app y la base responden
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/salud || exit 1

CMD ["node", "src/server.js"]
