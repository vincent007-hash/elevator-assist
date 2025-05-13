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
// Fonction pour lister les fichiers Drive avec recherche avancée
async function listDriveFiles(searchQuery) {
  try {
    const auth = await authorize();
    const drive = google.drive({ version: 'v3', auth });
    
    // Si searchQuery est une chaîne simple, on la traite comme avant
    let q = "trashed=false";
    if (typeof searchQuery === 'string') {
      if (searchQuery.startsWith("trashed=false")) {
        // C'est déjà une requête complète
        q = searchQuery;
      } else {
        // C'est juste un terme de recherche
        q += ` and (name contains '${searchQuery}' or fullText contains '${searchQuery}')`;
      }
    }

    // Fonction pour lister les fichiers Drive avec recherche améliorée
async function listDriveFiles(query) {
  try {
    const auth = await authorize();
    const drive = google.drive({ version: 'v3', auth });
    
    let q = "trashed=false";
    
    if (query) {
      // Détecter si la requête contient des mots-clés spécifiques
      const lowerQuery = query.toLowerCase();
      
      // Extraire les potentielles marques d'ascenseur de la requête
      const brands = ['kone', 'otis', 'schindler', 'thyssenkrupp', 'mitsubishi', 'orona'];
      const detectedBrands = brands.filter(brand => lowerQuery.includes(brand));
      
      // Extraire les potentiels types de documents de la requête
      const docTypes = {
        'pdf': 'application/pdf',
        'document': 'document',
        'feuille': 'spreadsheet',
        'excel': 'spreadsheet',
        'image': 'image/',
        'photo': 'image/'
      };
      
      let typeFilters = [];
      for (const [keyword, mimeType] of Object.entries(docTypes)) {
        if (lowerQuery.includes(keyword)) {
          typeFilters.push(`mimeType contains '${mimeType}'`);
        }
      }
      
      // Construire la requête de recherche avancée
      let searchTerms = [];
      
      // Ajouter les termes de recherche généraux
      searchTerms.push(`(name contains '${query}' or fullText contains '${query}')`);
      
      // Si des marques spécifiques sont détectées, les prioriser
      if (detectedBrands.length > 0) {
        const brandFilters = detectedBrands.map(brand => `name contains '${brand}'`);
        searchTerms.push(`(${brandFilters.join(' or ')})`);
      }
      
      // Si des types de documents sont détectés, les filtrer
      if (typeFilters.length > 0) {
        searchTerms.push(`(${typeFilters.join(' or ')})`);
      }
      
      // Combiner tous les termes de recherche
      q += ` and ${searchTerms.join(' and ')}`;
    }
    
    console.log("Requête de recherche:", q); // Pour le débogage
    
    const res = await drive.files.list({
      q: q,
      fields: 'files(id, name, mimeType, webViewLink)',
      spaces: 'drive',
      pageSize: 20,
      orderBy: 'relevance' // Trier par pertinence
    });
    
    // Transformer les résultats pour inclure des URL de prévisualisation sécurisées
    const files = res.data.files.map(file => {
      let previewUrl;
      
      // Générer l'URL de prévisualisation selon le type de fichier
      if (file.mimeType === 'application/pdf') {
        previewUrl = `https://drive.google.com/file/d/${file.id}/preview`;
      } else if (file.mimeType.includes('image/')) {
        previewUrl = `https://drive.google.com/file/d/${file.id}/preview`;
      } else if (file.mimeType.includes('spreadsheet')) {
        previewUrl = `https://docs.google.com/spreadsheets/d/${file.id}/preview`;
      } else if (file.mimeType.includes('document')) {
        previewUrl = `https://docs.google.com/document/d/${file.id}/preview`;
      } else {
        previewUrl = `https://drive.google.com/file/d/${file.id}/preview`;
      }
      
      return {
        ...file,
        previewUrl: previewUrl
      };
    });
    
    return files;
  } catch (error) {
    console.error('Erreur recherche Drive:', error);
    throw error;
  }
}


    const res = await drive.files.list({
      q: q,
      fields: 'files(id, name, mimeType, webViewLink)',
      spaces: 'drive',
      pageSize: 20
    });
    
    // Transformer les résultats pour inclure des URL de prévisualisation sécurisées
    const files = res.data.files.map(file => {
      let previewUrl;
      
      // Générer l'URL de prévisualisation selon le type de fichier
      if (file.mimeType === 'application/pdf') {
        previewUrl = `https://drive.google.com/file/d/${file.id}/preview`;
      } else if (file.mimeType.includes('image/')) {
        previewUrl = `https://drive.google.com/file/d/${file.id}/preview`;
      } else if (file.mimeType.includes('spreadsheet')) {
        previewUrl = `https://docs.google.com/spreadsheets/d/${file.id}/preview`;
      } else if (file.mimeType.includes('document')) {
        previewUrl = `https://docs.google.com/document/d/${file.id}/preview`;
      } else {
        previewUrl = `https://drive.google.com/file/d/${file.id}/preview`;
      }
      
      return {
        ...file,
        previewUrl: previewUrl
      };
    });
    
    return files;
  } catch (error) {
    console.error('Erreur recherche Drive:', error);
    throw error;
  }
}

// Fonction pour obtenir l'aperçu d'un fichier
async function getFilePreview(fileId) {
  try {
    const auth = await authorize();
    const drive = google.drive({ version: 'v3', auth });
    
    const file = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, webViewLink'
    });
    
    // Créer l'URL de prévisualisation sécurisée
    let previewUrl;
    if (file.data.mimeType === 'application/pdf') {
      // Format prévisualisation pour PDF sans téléchargement
      previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    } else if (file.data.mimeType.includes('image/')) {
      // Format prévisualisation pour images
      previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    } else if (file.data.mimeType.includes('spreadsheet')) {
      // Format prévisualisation pour feuilles de calcul
      previewUrl = `https://docs.google.com/spreadsheets/d/${fileId}/preview`;
    } else if (file.data.mimeType.includes('document')) {
      // Format prévisualisation pour documents
      previewUrl = `https://docs.google.com/document/d/${fileId}/preview`;
    } else {
      // Format par défaut
      previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    }
    
// Créer l'iframe avec des protections supplémentaires
const previewContainer = document.createElement('div');
previewContainer.innerHTML = `
  <div class="preview-wrapper" style="user-select: none;">
    <iframe 
      src="${previewUrl}"
      sandbox="allow-scripts allow-same-origin allow-popups"
      oncontextmenu="return false;"
      width="100%" height="100%">
    </iframe>
  </div>
`;

// Désactiver le clic droit
previewContainer.addEventListener('contextmenu', e => e.preventDefault());

    return {
      ...file.data,
      previewUrl: previewUrl
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
