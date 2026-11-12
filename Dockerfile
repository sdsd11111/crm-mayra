FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

# Instalar dependencias backend y compilar
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma/
RUN cd backend && npm install && npx prisma generate

COPY backend ./backend/
RUN cd backend && npm run build

# Instalar dependencias frontend y compilar
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

COPY frontend ./frontend/
RUN cd frontend && npm run build

# Stage de Producción
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache curl openssl libc6-compat

# Copiar backend
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/prisma ./backend/prisma

# Copiar frontend
COPY --from=builder /app/frontend/.next ./frontend/.next
COPY --from=builder /app/frontend/public ./frontend/public
COPY --from=builder /app/frontend/node_modules ./frontend/node_modules
COPY --from=builder /app/frontend/package.json ./frontend/

# Instalar concurrently
RUN npm install -g concurrently

EXPOSE 4000 3000

CMD ["npx", "concurrently", "--names", "API,WEB", "--prefix-colors", "blue,green", "node backend/dist/index.js", "npm --prefix frontend start"]
