# Use official Node.js LTS image
FROM node:20-alpine

WORKDIR /app

# Install all dependencies (including devDependencies for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Remove devDependencies after build
RUN npm prune --production

EXPOSE 4000
CMD ["node", "dist/index.js"]