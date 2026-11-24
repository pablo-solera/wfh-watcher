# syntax=docker/dockerfile:1

##
## 1) deps: instala TODAS las dependencias (incluidas devDependencies) para
##    poder compilar el proyecto TypeScript en la siguiente fase.
##
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

##
## 2) build: compila TypeScript -> JavaScript (dist/).
##
FROM node:26-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
RUN npm run build

##
## 3) prod-deps: instala solo las dependencias de producción, sin
##    devDependencies (typescript, tsx, @types/*).
##
FROM node:26-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

##
## 4) runtime: imagen final mínima. Solo contiene el JS ya compilado, las
##    dependencias de producción y un usuario sin privilegios.
##
FROM node:26-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# tini se usa como PID 1 para reenviar correctamente señales (SIGTERM/SIGINT).
# fontconfig y font-dejavu son necesarios para dibujar el texto del calendario:
# la imagen de Alpine no trae ninguna fuente.
RUN apk add --no-cache tini fontconfig font-dejavu

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Directorio del estado persistente (avisos ya enviados). Se monta como volumen.
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME /app/data

USER node

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/bot/telegram.js"]
