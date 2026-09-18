FROM node:18-alpine

# Install Java and essential tools
RUN apk add --no-cache \
    openjdk11 \
    openjdk11-jre \
    gradle \
    git \
    wget \
    curl \
    unzip \
    bash

# Set Java home
ENV JAVA_HOME=/usr/lib/jvm/java-11-openjdk
ENV PATH=$JAVA_HOME/bin:$PATH

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p uploads builds projects

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
