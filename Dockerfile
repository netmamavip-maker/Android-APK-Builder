# Multi-stage build for efficiency

# Stage 1: Android SDK base
FROM ubuntu:22.04

# Set environment variables
ENV ANDROID_HOME=/opt/android-sdk \
    PATH=$PATH:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/opt/android-sdk/build-tools/34.0.0 \
    JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64 \
    GRADLE_VERSION=8.0

# Install dependencies
RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    curl \
    git \
    openjdk-11-jdk \
    openjdk-11-jre \
    build-essential \
    libssl-dev \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Download and setup Android SDK
RUN mkdir -p /opt/android-sdk && cd /opt/android-sdk && \
    wget -q https://dl.google.com/android/repository/cmdline-tools-linux-9477014_latest.zip && \
    unzip -q cmdline-tools-linux-9477014_latest.zip && \
    rm cmdline-tools-linux-9477014_latest.zip && \
    mv cmdline-tools latest && \
    mkdir -p cmdline-tools && mv latest cmdline-tools/

# Install Android SDK components
RUN yes | /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=/opt/android-sdk \
    "platforms;android-34" \
    "platforms;android-33" \
    "build-tools;34.0.0" \
    "build-tools;33.0.0" \
    "ndk;25.1.8937393" \
    "cmdline-tools;latest" \
    "extras;android;m2repository" \
    "extras;google;m2repository" || true

# Install Gradle
RUN cd /opt && \
    wget -q https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip && \
    unzip -q gradle-${GRADLE_VERSION}-bin.zip && \
    rm gradle-${GRADLE_VERSION}-bin.zip && \
    ln -s gradle-${GRADLE_VERSION} gradle

ENV PATH=$PATH:/opt/gradle/bin

# Accept Android licenses
RUN yes | /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=/opt/android-sdk --licenses || true

# Stage 2: Application
FROM ubuntu:22.04

ENV ANDROID_HOME=/opt/android-sdk \
    PATH=$PATH:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/opt/android-sdk/build-tools/34.0.0:/opt/gradle/bin \
    JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64 \
    NODE_ENV=production

RUN apt-get update && apt-get install -y \
    openjdk-11-jdk \
    openjdk-11-jre \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Copy Android SDK and Gradle from first stage
COPY --from=0 /opt/android-sdk /opt/android-sdk
COPY --from=0 /opt/gradle /opt/gradle

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

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Start application
CMD ["npm", "start"]
