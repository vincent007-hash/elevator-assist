const tf = require('@tensorflow/tfjs-node');
const use = require('@tensorflow-models/universal-sentence-encoder');
const { ChromaClient } = require('chromadb');
const pdf = require('pdf-parse');
const Tesseract = require('tesseract.js');

class SemanticSearch {
  constructor() {
    this.model = null;
    this.client = new ChromaClient();
    this.collection = null;
  }

  async initialize() {
    try {
      console.log("Initialisation du modèle d'embeddings...");
      this.model = await use.load();
      console.log("Modèle chargé avec succès");
      
      console.log("Connexion à ChromaDB...");
      this.collection = await this.client.createCollection('elevator-docs');
      console.log("Collection ChromaDB créée avec succès");
      
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
      
      // OCR (pour les parties scannées/images)
      const { data: { text: ocrText } } = await Tesseract.recognize(
        buffer, 
        'fra', 
        { logger: m => console.log(m) }
      );
      
      // Fusion des textes
      const fullText = pdfData.text + '\n' + ocrText;
      console.log(`Texte extrait: ${fullText.length} caractères`);
      
      // Découpage adapté aux documents techniques
      const chunks = this.splitTechnicalText(fullText);
      console.log(`Document découpé en ${chunks.length} segments`);
      
      // Génération des embeddings
      console.log("Génération des embeddings...");
      const embeddings = await this.model.embed(chunks);
      
      // Stockage dans ChromaDB
      console.log("Stockage dans ChromaDB...");
      const ids = chunks.map((_, i) => `doc-${metadata.id || Date.now()}-chunk-${i}`);
      
      await this.collection.add({
        ids: ids,
        embeddings: embeddings.arraySync(),
        documents: chunks,
        metadatas: chunks.map(text => ({
          ...metadata,
          containsCode: /code erreur|défaut [A-Z0-9]{4}/i.test(text),
          containsSchema: /schéma|circuit|diagram/i.test(text),
          length: text.length
        }))
      });
      
      console.log("PDF traité et indexé avec succès");
      return {
        success: true,
        chunks: chunks.length
      };
    } catch (error) {
      console.error("Erreur de traitement du PDF:", error);
      throw error;
    }
  }

  splitTechnicalText(text) {
    // Découpage adapté aux documents techniques
    const chunks = [];
    const paragraphs = text.split(/\n\s*\n/);
    
    let currentChunk = '';
    const MAX_CHUNK_SIZE = 1000;
    
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
      console.log(`Recherche: "${query}"`);
      
      // Génération de l'embedding pour la requête
      const queryEmbedding = await this.model.embed([query]);
      
      // Recherche dans ChromaDB
      const results = await this.collection.query({
        queryEmbeddings: queryEmbedding.arraySync(),
        nResults: 5
      });
      
      console.log(`${results.documents.length} résultats trouvés`);
      
      return {
        results: results.documents.map((doc, i) => ({
          text: doc,
          score: results.distances[i],
          metadata: results.metadatas[i]
        })),
        answer: this.generateAnswer(query, results.documents)
      };
    } catch (error) {
      console.error("Erreur de recherche:", error);
      throw error;
    }
  }

  generateAnswer(question, contexts) {
    // Version simple - à remplacer par un LLM plus tard
    const contextStr = contexts.join('\n\n');
    return `D'après la documentation technique, voici les informations pertinentes :\n\n${contextStr.substring(0, 1500)}...`;
  }
}

module.exports = new SemanticSearch();
