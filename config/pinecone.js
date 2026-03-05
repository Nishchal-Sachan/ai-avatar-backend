import { Pinecone } from "@pinecone-database/pinecone";

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const indexName = process.env.PINECONE_INDEX?.trim() || "ai-avatar-index";
export const pineconeIndex = pinecone.index(indexName);
