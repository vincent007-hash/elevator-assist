FROM node:18

# Installation des dépendances système
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    tesseract-ocr \
    tesseract-ocr-fra \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier package.json
COPY package*.json ./

# Installer les dépendances
RUN npm install
RUN npm install express-fileupload

# Copier le reste des fichiers
COPY . .

CMD ["node", "server.js"]
