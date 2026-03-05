import { Pinecone } from "@pinecone-database/pinecone";

let _pineconeIndex = null;

export function getPineconeIndex() {
  if (_pineconeIndex) return _pineconeIndex;
  const apiKey = process.env.PINECONE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("PINECONE_API_KEY is required for Pinecone");
  }
  const pinecone = new Pinecone({ apiKey });
  const indexName = process.env.PINECONE_INDEX?.trim() || "ai-avatar-index";
  _pineconeIndex = pinecone.index(indexName);
  return _pineconeIndex;
}
