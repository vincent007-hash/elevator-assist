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

# Installer les dépendances avec versions spécifiques
RUN npm install
RUN npm install @tensorflow/tfjs@4.1.0
RUN npm install @tensorflow/tfjs-node@4.1.0
RUN npm install @tensorflow-models/universal-sentence-encoder@1.3.3
RUN npm install express-fileupload
RUN npm install node-fetch

# Copier le reste des fichiers
COPY . .

CMD ["node", "server.js"]
