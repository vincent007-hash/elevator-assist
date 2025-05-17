FROM node:16

# Installation des dépendances système nécessaires
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    python3-pip \
    tesseract-ocr \
    tesseract-ocr-fra \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier uniquement package.json d'abord pour exploiter le cache Docker
COPY package*.json ./

# Installer explicitement TensorFlow.js avec --build-from-source
RUN npm install
RUN npm install @tensorflow/tfjs-node --build-from-source

# Copier le reste des fichiers
COPY . .

# Commande pour démarrer l'application
CMD ["node", "server.js"]
