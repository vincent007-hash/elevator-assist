FROM node:16

# Installation des dépendances système
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    tesseract-ocr \
    tesseract-ocr-fra \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le reste des fichiers
COPY . .

# Exposer le port
EXPOSE 10000

# Commande de démarrage
CMD ["node", "server.js"]
