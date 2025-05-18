const tf = require('@tensorflow/tfjs-node');
const use = require('@tensorflow-models/universal-sentence-encoder');
const pdf = require('pdf-parse');

class SemanticSearch {
  constructor() {
    this.model = null;
    this.documents = [];
  }

  async initialize() {
    try {
      console.log("Chargement du modèle USE...");
      this.model = await use.load();
      console.log("Modèle chargé avec succès");
      return true;
    } catch (error) {
      console.error("Erreur d'initialisation:", error);
      throw error;
    }
  }

  async processPDF(buffer, metadata = {}) {
    try {
      console.log("Traitement du PDF...");
      
      // Extraction texte standard
      const pdfData = await pdf(buffer);
      console.log(`PDF analysé: ${pdfData.numpages} pages`);
      
      // Découpage en paragraphes
      const chunks = this.splitText(pdfData.text);
      console.log(`Document découpé en ${chunks.length} segments`);
      
      // Génération des embeddings
      console.log("Génération des embeddings...");
      const embeddings = await this.model.embed(chunks);
      
      // Stocker les embeddings et le texte
      for (let i = 0; i < chunks.length; i++) {
        this.documents.push({
          text: chunks[i],
          embedding: embeddings.slice([i, 0], [1, -1]),
          metadata: {
            ...metadata,
            page: Math.floor(i / 5) + 1
          }
        });
      }
      
      console.log("PDF traité et indexé avec succès");
      return { success: true, chunks: chunks.length };
    } catch (error) {
      console.error("Erreur de traitement du PDF:", error);
      throw error;
    }
  }

  splitText(text) {
    const chunks = [];
    const paragraphs = text.split(/\n\s*\n/);
    
    let currentChunk = '';
    const MAX_CHUNK_SIZE = 500;
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > MAX_CHUNK_SIZE) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = paragraph;
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
      
      console.log(`Recherche: "${query}"`);
      
      // Génération de l'embedding pour la requête
      const queryEmbedding = await this.model.embed([query]);
      
      // Calculer la similarité avec tous les documents
      const results = this.documents.map(doc => {
        // Calculer la similarité cosinus
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
      
      // Retourner les 5 meilleurs résultats
      const topResults = results.slice(0, 5);
      console.log(`${topResults.length} résultats trouvés`);
      
      return {
        results: topResults,
        answer: this.generateAnswer(query, topResults.map(r => r.text))
      };
    } catch (error) {
      console.error("Erreur de recherche:", error);
      throw error;
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
