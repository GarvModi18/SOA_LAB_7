FROM node:20-alpine

WORKDIR /app

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application source code
COPY . .

# Expose gateway port
EXPOSE 3000

# Start the API Gateway
CMD ["node", "server.js"]
