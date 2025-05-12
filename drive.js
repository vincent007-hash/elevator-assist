const fs = require('fs');
const { google } = require('googleapis');

// Chemins des fichiers d'authentification
const CREDENTIALS_PATH = 'credentials.json';
const TOKEN_PATH = 'token.json';
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

// Fonction d'autorisation
async function authorize() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_secret, client_id, redirect_uris } = credentials.web;
const oAuth2Client = new google.auth.OAuth2(
  client_id, 
  client_secret, 
  redirect_uris[0]
);

  
  // Vérifier si un token existe déjà
  if (fs.existsSync(TOKEN_PATH)) {
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
    return oAuth2Client;
  }
  
  // Générer une URL d'autorisation
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  
  console.log('Autorisez cette application en visitant ce lien :', authUrl);
  
  // Attendre le code d'autorisation via le callback
  const code = await waitForCallback();
  
  // Échanger le code contre un token
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  
  // Sauvegarder le token
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  return oAuth2Client;
}

// Fonction pour attendre le callback
function waitForCallback() {
  return new Promise((resolve) => {
    global.resolveAuthCode = resolve;
  });
}
 // Dans drive.js, modifiez la fonction listDriveFiles comme suit:
async function listDriveFiles(query = '') {
  const authClient = await authorize();
  const drive = google.drive({ version: 'v3', auth: authClient });
  
  let queryString = 'trashed=false';
  
  if (query) {
    // Utiliser une recherche plus large combinant name et fullText
    queryString += ` and (name contains '${query}' or fullText contains '${query}')`;
  }
  
  console.log('Requête Drive: ' + queryString);
  
  const res = await drive.files.list({
    q: queryString,
    pageSize: 30,
    fields: 'files(id, name, mimeType, webViewLink)',
  });
  
  return res.data.files;
}


// Fonction pour obtenir les informations de prévisualisation d'un fichier
async function getFilePreview(fileId) {
  const authClient = await authorize();
  const drive = google.drive({ version: 'v3', auth: authClient });
  
  // Récupérer les métadonnées du fichier
  const file = await drive.files.get({
    fileId: fileId,
    fields: 'id,name,mimeType'
  });
  
  // Générer l'URL de prévisualisation selon le type de fichier
  let previewUrl;
  const mimeType = file.data.mimeType;
  
  if (mimeType.includes('pdf')) {
    previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
  } else if (mimeType.includes('image')) {
    previewUrl = `https://drive.google.com/uc?id=${fileId}`;
  } else if (mimeType.includes('spreadsheet')) {
    previewUrl = `https://docs.google.com/spreadsheets/d/${fileId}/preview`;
  } else if (mimeType.includes('document')) {
    previewUrl = `https://docs.google.com/document/d/${fileId}/preview`;
  } else if (mimeType.includes('presentation')) {
    previewUrl = `https://docs.google.com/presentation/d/${fileId}/preview`;
  } else {
    previewUrl = `https://docs.google.com/viewer?embedded=true&url=https://drive.google.com/uc?id=${fileId}&export=download`;
  }
  
  return {
    id: fileId,
    name: file.data.name,
    mimeType: mimeType,
    previewUrl: previewUrl
  };
}

module.exports = { authorize, listDriveFiles, getFilePreview };
