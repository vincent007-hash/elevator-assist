const fs = require('fs');
const { google } = require('googleapis');

// Fonction d'autorisation avec compte de service
async function authorize() {
  try {
    // Charger les informations du compte de service
    const serviceAccount = require('./service-account.json');
    
    // Créer un client JWT avec le compte de service
    const auth = new google.auth.JWT(
      serviceAccount.client_email,
      null,
      serviceAccount.private_key,
      ['https://www.googleapis.com/auth/drive.readonly']
    );
    
    // Authentifier avec les identifiants
    await auth.authorize();
    console.log('Authentification réussie avec le compte de service');
    return auth;
  } catch (error) {
    console.error('Erreur d\'authentification:', error);
    throw error;
  }
}

// Fonction pour lister les fichiers Drive (adaptez selon votre code existant)
async function listDriveFiles(query) {
  try {
    const auth = await authorize();
    const drive = google.drive({ version: 'v3', auth });
    
    let q = "trashed=false";
    if (query) {
      q += ` and (name contains '${query}' or fullText contains '${query}')`;
    }
    
    const res = await drive.files.list({
      q: q,
      fields: 'files(id, name, mimeType, webViewLink)',
      spaces: 'drive',
      pageSize: 10
    });
    
    return res.data.files;
  } catch (error) {
    console.error('Erreur recherche Drive:', error);
    throw error;
  }
}

// Fonction pour obtenir l'aperçu d'un fichier (adaptez selon votre code existant)
async function getFilePreview(fileId) {
  try {
    const auth = await authorize();
    const drive = google.drive({ version: 'v3', auth });
    
    const file = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, webViewLink, webContentLink'
    });
    
    return {
      ...file.data,
      previewUrl: file.data.webViewLink
    };
  } catch (error) {
    console.error('Erreur lors de la récupération du fichier:', error);
    throw error;
  }
}

module.exports = {
  authorize,
  listDriveFiles,
  getFilePreview
};
