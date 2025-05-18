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

# Installer les dépendances de base
RUN npm install
RUN npm install express-fileupload
RUN npm install node-fetch@2.6.7

# Installer TensorFlow.js avec la version spécifique compatible
RUN npm install @tensorflow/tfjs@3.6.0
RUN npm install @tensorflow/tfjs-converter@3.6.0
RUN npm install @tensorflow/tfjs-core@3.6.0
RUN npm install @tensorflow/tfjs-node@3.6.0 --build-from-source

# Installer Universal Sentence Encoder après TensorFlow
RUN npm install @tensorflow-models/universal-sentence-encoder --legacy-peer-deps

# Copier le reste des fichiers
COPY . .

CMD ["node", "server.js"]
