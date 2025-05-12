const express = require('express');
const multer = require('multer');
const path = require('path');
const { google } = require('googleapis');
const { authorize, listDriveFiles, getFilePreview } = require('./drive.js');

const app = express();
const PORT = 3000;
const upload = multer({ dest: 'uploads/' });

// Configuration
app.use(express.static('public'));
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, 'images')));

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

app.listen(PORT, () => console.log(`Serveur prêt sur http://localhost:${PORT}`));
