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

# Copier uniquement package.json d'abord pour exploiter le cache Docker
COPY package*.json ./

# Installer les dépendances normales
RUN npm install

# Installer TensorFlow et le modèle USE explicitement
RUN npm install @tensorflow/tfjs-node --build-from-source
RUN npm install @tensorflow-models/universal-sentence-encoder

# Copier le reste des fichiers
COPY . .

# Commande pour démarrer l'application
CMD ["node", "server.js"]
