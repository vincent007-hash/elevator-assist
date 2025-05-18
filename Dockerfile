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
RUN npm install node-fetch@2.6.7


# Télécharger le modèle USE pendant la construction de l'image
RUN mkdir -p /root/.cache/tfjs-models/
WORKDIR /root/.cache/tfjs-models/
RUN curl -O https://tfhub.dev/tensorflow/tfjs-model/universal-sentence-encoder/1/default/1/model.json
RUN curl -O https://tfhub.dev/tensorflow/tfjs-model/universal-sentence-encoder/1/default/1/group1-shard1of1.bin
WORKDIR /app


# Copier le reste des fichiers
COPY . .

CMD ["node", "server.js"]
