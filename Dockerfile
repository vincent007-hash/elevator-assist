FROM node:18

# Installation des dépendances système nécessaires
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    python3-pip \
    tesseract-ocr \
    tesseract-ocr-fra \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier uniquement package.json d'abord
COPY package*.json ./

# Installer les dépendances normales
RUN npm install

# Installer TensorFlow avec build from source
RUN npm install @tensorflow/tfjs-node@3.21.0 --build-from-source

# Installer USE avec legacy-peer-deps
RUN npm install @tensorflow-models/universal-sentence-encoder --legacy-peer-deps

# Copier le reste des fichiers
COPY . .

# Commande pour démarrer l'application
CMD ["node", "server.js"]
