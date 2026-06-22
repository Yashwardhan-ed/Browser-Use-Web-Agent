# Use the official Microsoft Playwright environment image
FROM mcr.microsoft.com/playwright:v1.44.1-jammy

# Create app directory
WORKDIR /usr/src/app

# Copy package configuration files
COPY package*.json ./

# Install Node dependencies cleanly
RUN npm ci

# Copy backend source files
COPY . .

# Expose Express server port
EXPOSE 7860

# Start Express backend server
CMD [ "node", "server.js" ]
