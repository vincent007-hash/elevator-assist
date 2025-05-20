const tf = require('@tensorflow/tfjs-node');
const use = require('@tensorflow-models/universal-sentence-encoder');
const fetch = require('node-fetch');
const pdf = require('pdf-parse');
const fs = require('fs');
const path = require('path');

// Définir fetch global pour USE
global.fetch = fetch;

class SemanticSearch {
  constructor() {
    this.model = null;
    this.documents = [];
    this.dataPath = path.join('/tmp', 'data');
    this.embeddingsPath = path.join(this.dataPath, 'embeddings.json');
    this.initializeDataDirectory();
  }

  initializeDataDirectory() {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  async loadDocuments() {
    try {
      if (fs.existsSync(this.embeddingsPath)) {
        const data = JSON.parse(fs.readFileSync(this.embeddingsPath, 'utf8'));
        this.documents = data.map(doc => ({
          ...doc,
          embedding: tf.tensor(doc.embedding)
        }));
        console.log(`${this.documents.length} documents chargés depuis le stockage`);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des documents:", error);
      this.documents = [];
    }
  }

  async saveDocuments() {
    try {
      const data = this.documents.map(doc => ({
        ...doc,
        embedding: doc.embedding.arraySync()
      }));
      fs.writeFileSync(this.embeddingsPath, JSON.stringify(data));
      console.log("Documents sauvegardés avec succès");
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des documents:", error);
    }
  }

  async initialize() {
    try {
      console.log("Chargement du modèle USE...");
      this.model = await use.load();
      console.log("Modèle chargé avec succès");
      await this.loadDocuments();
      return true;
    } catch (error) {
      console.error("Erreur d'initialisation:", error);
      throw error;
    }
  }

// Ajouter cette méthode à votre classe SemanticSearch
preprocessTechnicalText(text) {
    // Normaliser les codes d'erreur (ex: E0107, E-0107, Error 0107)
    text = text.replace(/[Ee][-\s]?(\d{4})/g, 'CODE_$1');
    
    // Normaliser les références de modèles d'ascenseurs
    text = text.replace(/(KONE|OTIS|SCHINDLER|THYSSEN)[\s-]([A-Z0-9]+)/gi, '$1_$2');
    
    // Normaliser les unités de mesure
    text = text.replace(/(\d+)[\s]?(kg|mm|cm|m|A|V)/g, '$1_$2');
    
    return text;
  }  

  async processPDF(buffer, metadata = {}) {
    try {
      console.log("Traitement du PDF...");
      
      // Extraction texte standard
      const pdfData = await pdf(buffer);
      console.log(`PDF analysé: ${pdfData.numpages} pages`);
      
      // Prétraitement du texte
      const processedText = this.preprocessTechnicalText(pdfData.text);
      
      // Découpage en chunks
      const chunks = this.splitText(processedText);
      console.log(`Document découpé en ${chunks.length} segments`);
      
      // Génération des embeddings par lots
      console.log("Génération des embeddings par lots...");
      const BATCH_SIZE = 10;
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const batchEmbeddings = await this.model.embed(batch);
        for (let j = 0; j < batch.length; j++) {
          this.documents.push({
            text: batch[j],
            embedding: batchEmbeddings.slice([j, 0], [1, -1]),
            metadata: {
              ...metadata,
              page: Math.floor((i + j) / 5) + 1,
              processedAt: new Date().toISOString()
            }
          });
        }
        console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} traité (${i + batch.length}/${chunks.length})`);
      }
      
      console.log('Exemple de chunk indexé :', chunks[0]);
      
      // Sauvegarder les documents après traitement
      await this.saveDocuments();
      
      console.log("PDF traité et indexé avec succès");
      return { success: true, chunks: chunks.length };
    } catch (error) {
      console.error("Erreur de traitement du PDF:", error);
      throw new Error(`Erreur de traitement du PDF: ${error.message}`);
    }
  }

  splitText(text) {
    const chunks = [];
    const paragraphs = text.split(/\n\s*\n/);
    
    let currentChunk = '';
    const MAX_CHUNK_SIZE = 1500;
    const OVERLAP_SIZE = 100;
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > MAX_CHUNK_SIZE) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          // Garder une partie du texte pour le chevauchement
          const words = currentChunk.split(' ');
          currentChunk = words.slice(Math.max(0, words.length - OVERLAP_SIZE)).join(' ');
        }
        currentChunk += paragraph;
      } else {
        currentChunk += '\n\n' + paragraph;
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.filter(chunk => chunk.length > 50);
  }

  async search(query) {
    try {
      if (!this.model) {
        throw new Error("Le modèle n'est pas initialisé");
      }
      
      if (this.documents.length === 0) {
        return {
          results: [],
          answer: "Aucun document n'a été indexé pour le moment."
        };
      }
      
      console.log(`Recherche: "${query}"`);
      
      // Prétraitement de la requête
      const processedQuery = this.preprocessTechnicalText(query);
      
      // Génération de l'embedding pour la requête
      const queryEmbedding = await this.model.embed([processedQuery]);
      
      // Calculer la similarité avec tous les documents
      const results = this.documents.map(doc => {
        const similarity = this.cosineSimilarity(
          queryEmbedding.arraySync()[0],
          doc.embedding.arraySync()[0]
        );
        
        return {
          text: doc.text,
          score: similarity,
          metadata: doc.metadata
        };
      });
      
      // Trier par score de similarité
      results.sort((a, b) => b.score - a.score);
      
      // Filtrer les résultats avec un seuil de similarité
      const SIMILARITY_THRESHOLD = 0.3;
      const topResults = results
        .filter(r => r.score > SIMILARITY_THRESHOLD)
        .slice(0, 5);
      
      console.log(`${topResults.length} résultats trouvés`);
      console.log('Score de similarité pour chaque segment :', results.map(r => r.score));
      
      return {
        results: topResults,
        answer: this.generateAnswer(query, topResults.map(r => r.text))
      };
    } catch (error) {
      console.error("Erreur de recherche:", error);
      throw new Error(`Erreur de recherche: ${error.message}`);
    }
  }

  cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magA * magB);
  }

  generateAnswer(question, contexts) {
    const contextStr = contexts.join('\n\n');
    return `D'après la documentation technique, voici les informations pertinentes :\n\n${contextStr.substring(0, 1500)}...`;
  }
}

module.exports = new SemanticSearch();
