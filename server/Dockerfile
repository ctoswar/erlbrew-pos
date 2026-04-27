# Node.js 20 Alpine image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --silent

# Copy app code
COPY . .

EXPOSE 3001
CMD ["node", "src/index.js"]
