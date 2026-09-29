FROM node:20-alpine

WORKDIR /app

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application source code
COPY . .

# Expose service port
EXPOSE 3001

# Start the application
CMD ["node", "server.js"]
