const { GPT4AllEmbeddings } = require('gpt4all');
const { VectraIndex } = require('vectra');

// Initialisation du modèle d'embedding
const gpt4all_embd = new GPT4AllEmbeddings();

// Création d'un index vectoriel
const index = new VectraIndex('./data/ascenseurs_index');

// Fonction pour insérer du texte et générer des embeddings
async function insertText(text, metadata = {}) {
  // Génération de l'embedding
  const vector = await gpt4all_embd.embed_query(text);
  
  // Ajout à l'index vectoriel
  await index.insertItem({
    vector,
    metadata: {
      ...metadata,
      text
    }
  });
  
  console.log(`Texte indexé: ${metadata.title || 'Sans titre'}`);
}

// Fonction de recherche sémantique
async function search(query, limit = 3) {
  // Génération de l'embedding pour la requête
  const vector = await gpt4all_embd.embed_query(query);
  
  // Recherche des documents similaires
  const results = await index.queryItems(vector, limit);
  
  return results.map(result => ({
    score: result.score,
    text: result.item.metadata.text,
    title: result.item.metadata.title
  }));
}

module.exports = { insertText, search };
