FROM node:16

# Installation des dépendances système nécessaires
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    tesseract-ocr \
    tesseract-ocr-fra \
    && rm -rf /var/lib/apt/lists/*

# Définir le répertoire de travail
WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le reste des fichiers du projet
COPY . .

# Commande pour démarrer l'application
CMD ["node", "server.js"]
