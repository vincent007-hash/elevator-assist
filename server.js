const express = require('express');
const fileUpload = require('express-fileupload');
const multer = require('multer');
const path = require('path');
const { google } = require('googleapis');
const { authorize, listDriveFiles, getFilePreview } = require('./drive.js');
const fs = require('fs');
const pdf = require('pdf-parse');
const use = require('@tensorflow-models/universal-sentence-encoder');

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Nouvelle route pour la recherche sémantique
app.post('/api/semantic-search', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Requête de recherche manquante' });
    }
    
    const results = await semanticSearch.search(query);
    res.json(results);
  } catch (error) {
    console.error("Erreur de recherche:", error);
    res.status(500).json({ error: error.message });
  }
});


// Configuration
app.use(express.static('public'));
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// Base de données simplifiée
const documents = [];

// Routes principales
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    const doc = {
      id: Date.now().toString(),
      name: req.file.originalname,
      path: req.file.path
    };
    documents.push(doc);
    res.json({ success: true, document: doc.name });
  } catch (error) {
    res.status(500).json({ error: 'Erreur upload' });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q?.toLowerCase();
    if (!query) return res.status(400).json({ error: 'Requête vide' });

    // Recherche locale
    const localResults = documents
      .filter(doc => doc.name.toLowerCase().includes(query))
      .map(doc => ({
        source: 'local',
        name: doc.name,
        id: doc.id
      }));

    // Recherche Drive
    let driveResults = [];
    try {
      const files = await listDriveFiles(query);
      driveResults = files.map(file => ({
        source: 'drive',
        name: file.name,
        fileId: file.id,
        mimeType: file.mimeType,
        passages: [`Trouvé dans Google Drive: ${file.name}`]
      }));
    } catch (driveError) {
      console.error('Erreur recherche Drive:', driveError);
    }

    res.json({ results: [...localResults, ...driveResults] });
  } catch (error) {
    console.error('Erreur recherche:', error);
    res.status(500).json({ error: 'Erreur recherche' });
  }
});

// Routes Google Drive
app.get('/api/drive-files', async (req, res) => {
  try {
    const files = await listDriveFiles(req.query.q);
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: 'Erreur Drive' });
  }
});

// Ajouter cette route pour visualiser un fichier
app.get('/api/view-file/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const fileInfo = await getFilePreview(fileId);
    res.json(fileInfo);
  } catch (error) {
    console.error('Erreur visualisation:', error);
    res.status(500).json({ error: 'Erreur récupération fichier' });
  }
});

const semanticSearchService = require('./semantic-search');

// Initialisation du service de recherche sémantique
(async () => {
  try {
    await semanticSearchService.initialize();
    console.log("Service de recherche sémantique initialisé avec succès");
  } catch (error) {
    console.error("Erreur d'initialisation du service de recherche sémantique:", error);
    process.exit(1); // Arrêter le serveur si l'initialisation échoue
  }
})();

// Route pour l'indexation des PDFs
app.post('/api/index-pdf', async (req, res) => {
  try {
    console.log('req.files:', req.files);
    if (!req.files) {
      return res.status(400).json({ error: 'Aucun fichier uploadé (req.files est vide)' });
    }
    if (!req.files.pdf) {
      // Affiche tous les noms de champs reçus pour aider au debug
      return res.status(400).json({ error: `Aucun fichier PDF fourni. Champs reçus: ${Object.keys(req.files).join(', ')}` });
    }
    if (!req.files.pdf.data && !req.files.pdf.tempFilePath) {
      return res.status(400).json({ error: 'Impossible de lire le fichier PDF.' });
    }

    let pdfBuffer;
    if (req.files.pdf.data && req.files.pdf.data.length > 0) {
      pdfBuffer = req.files.pdf.data;
      console.log('Lecture du PDF depuis req.files.pdf.data');
    } else if (req.files.pdf.tempFilePath) {
      pdfBuffer = fs.readFileSync(req.files.pdf.tempFilePath);
      console.log('Lecture du PDF depuis tempFilePath:', req.files.pdf.tempFilePath);
    } else {
      return res.status(400).json({ error: 'Impossible de lire le fichier PDF.' });
    }
    console.log('Taille du PDF reçu :', pdfBuffer.length);
    
    const documentType = req.body.documentType || 'unknown';
    const elevatorBrand = req.body.elevatorBrand || 'unknown';
    
    const result = await semanticSearchService.processPDF(pdfBuffer, {
      filename: req.files.pdf.name,
      documentType: documentType,
      elevatorBrand: elevatorBrand,
      uploadedAt: new Date().toISOString()
    });
    
    res.json(result);
  } catch (error) {
    console.error("Erreur d'indexation:", error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour la recherche sémantique
app.post('/api/semantic-search', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Requête de recherche manquante' });
    }
    
    const results = await semanticSearchService.search(query);
    res.json(results);
  } catch (error) {
    console.error("Erreur de recherche:", error);
    res.status(500).json({ error: error.message });
  }
});


// Ajouter cette route pour le callback OAuth
app.get('/oauth2callback', (req, res) => {
  const code = req.query.code;
  if (code) {
    if (global.resolveAuthCode) {
      global.resolveAuthCode(code);
    }
    res.send("Authentification réussie ! Vous pouvez fermer cette fenêtre.");
  } else {
    res.status(400).send("Erreur: code d'autorisation manquant");
  }
});

app.post('/api/semantic-search-drive', async (req, res) => {
  console.log('req.body:', req.body); // Debug
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Le body de la requête est vide ou mal formé.' });
  }
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Requête manquante' });

    // 1. Lister les fichiers Drive pertinents (ex: PDF)
    const files = await listDriveFiles(""); // ou "pdf" pour forcer tous les PDF
    console.log('Fichiers Drive trouvés:', files.map(f => f.name));

    // 2. Charger le modèle sémantique
    const model = await use.load();

    // 3. Générer l'embedding de la requête
    const queryEmbedding = await model.embed([query]);
    const queryVec = queryEmbedding.arraySync()[0];

    let results = [];

    // 4. Pour chaque fichier, extraire le texte et scorer
    for (const file of files) {
      if (!file.mimeType.startsWith('application/pdf')) continue;

      // Télécharger le PDF depuis Drive
      const auth = await authorize();
      const drive = google.drive({ version: 'v3', auth });
      const pdfRes = await drive.files.get(
        { fileId: file.id, alt: 'media' },
        { responseType: 'arraybuffer' }
      );
      const pdfBuffer = Buffer.from(pdfRes.data);

      let pdfData, text;
      try {
        pdfData = await pdf(pdfBuffer);
        text = pdfData.text;
        console.log(`Texte extrait (${text.length} caractères)`);
      } catch (e) {
        console.log(`Erreur extraction PDF pour ${file.name}:`, e.message);
        continue;
      }

      console.log(`Texte extrait du fichier ${file.name} :`, text.substring(0, 200));

      // Découper en chunks
      const chunks = [];
      for (let i = 0; i < text.length; i += 500) {
        const chunk = text.slice(i, i + 500);
        if (chunk.length > 50) chunks.push(chunk);
      }
      console.log(`Nombre de chunks générés: ${chunks.length}`);

      // Générer les embeddings pour chaque chunk
      const chunkEmbeddings = await model.embed(chunks);

      // Calculer la similarité pour chaque chunk
      const chunkScores = chunkEmbeddings.arraySync().map(chunkVec =>
        cosineSimilarity(queryVec, chunkVec)
      );

      // Prendre le meilleur chunk
      let bestIdx = 0;
      let bestScore = chunkScores[0] || 0;
      for (let i = 1; i < chunkScores.length; i++) {
        if (chunkScores[i] > bestScore) {
          bestScore = chunkScores[i];
          bestIdx = i;
        }
      }

      console.log(`Analyse du fichier: ${file.name}, ${chunks.length} chunks`);
      console.log('Scores:', chunkScores);
      console.log(`Meilleur score trouvé: ${bestScore.toFixed(4)}`);
      if (chunks[bestIdx]) {
        console.log('Meilleur passage:', chunks[bestIdx].substring(0, 200), '...');
      }

      results.push({
        fileName: file.name,
        fileId: file.id,
        previewUrl: file.previewUrl,
        passage: chunks[bestIdx] || 'Aucun passage pertinent trouvé',
        score: bestScore
      });
    }

    // Trier par score décroissant
    results.sort((a, b) => b.score - a.score);

    // Retourner les meilleurs résultats
    res.json({ results: results.slice(0, 5) });
  } catch (error) {
    console.error('Erreur recherche sémantique Drive:', error);
    res.status(500).json({ error: error.message });
  }
});

function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magA * magB);
}

app.listen(process.env.PORT || 10000, '0.0.0.0', () => {
  console.log(`Serveur démarré sur le port ${process.env.PORT || 10000}`);
});

