import {
  KnowledgeDocument,
  KnowledgeCategory,
  KnowledgeEntityRelationship,
} from '@/types/intelligence';
import { mockKnowledgeDocuments } from '@/mocks/db/intelligence/knowledge';

class KnowledgeService {
  private documents: KnowledgeDocument[] = [...mockKnowledgeDocuments];

  async getDocuments(params?: {
    category?: string;
    department?: string;
    projectCode?: string;
    tag?: string;
    search?: string;
  }): Promise<KnowledgeDocument[]> {
    await new Promise((r) => setTimeout(r, 40));

    return this.documents.filter((doc) => {
      if (params?.category && params.category !== 'ALL' && doc.category !== params.category) {
        return false;
      }
      if (params?.department && params.department !== 'ALL' && doc.department_name !== params.department) {
        return false;
      }
      if (params?.projectCode && params.projectCode !== 'ALL' && doc.project_code !== 'ALL' && doc.project_code !== params.projectCode) {
        return false;
      }
      if (params?.tag && !doc.tags.includes(params.tag)) {
        return false;
      }
      if (params?.search) {
        const q = params.search.toLowerCase();
        const fullText = [doc.title, doc.summary, doc.content_markdown, ...(doc.tags || [])]
          .join(' ')
          .toLowerCase();
        if (!fullText.includes(q)) return false;
      }
      return true;
    });
  }

  async getDocument(id: string): Promise<KnowledgeDocument | undefined> {
    await new Promise((r) => setTimeout(r, 20));
    const doc = this.documents.find((d) => d.id === id);
    if (doc) {
      doc.views_count += 1;
    }
    return doc;
  }

  async createDocument(
    docData: Omit<KnowledgeDocument, 'id' | 'created_at' | 'updated_at' | 'views_count' | 'likes_count'>
  ): Promise<KnowledgeDocument> {
    const newDoc: KnowledgeDocument = {
      ...docData,
      id: `kdoc-${Date.now()}`,
      views_count: 1,
      likes_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.documents.unshift(newDoc);
    return newDoc;
  }

  async updateDocument(id: string, updates: Partial<KnowledgeDocument>): Promise<KnowledgeDocument> {
    const index = this.documents.findIndex((d) => d.id === id);
    if (index === -1) throw new Error('Document not found');

    const updated = {
      ...this.documents[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.documents[index] = updated;
    return updated;
  }

  async deleteDocument(id: string): Promise<void> {
    this.documents = this.documents.filter((d) => d.id !== id);
  }

  async toggleLike(id: string): Promise<number> {
    const doc = this.documents.find((d) => d.id === id);
    if (!doc) return 0;
    doc.likes_count += 1;
    return doc.likes_count;
  }

  async linkEntity(docId: string, link: Omit<KnowledgeEntityRelationship, 'id'>): Promise<KnowledgeDocument> {
    const doc = this.documents.find((d) => d.id === docId);
    if (!doc) throw new Error('Document not found');

    const newLink: KnowledgeEntityRelationship = {
      ...link,
      id: `klink-${Date.now()}`,
    };
    doc.linked_entities.push(newLink);
    doc.updated_at = new Date().toISOString();
    return doc;
  }

  async unlinkEntity(docId: string, linkId: string): Promise<KnowledgeDocument> {
    const doc = this.documents.find((d) => d.id === docId);
    if (!doc) throw new Error('Document not found');

    doc.linked_entities = doc.linked_entities.filter((l) => l.id !== linkId);
    doc.updated_at = new Date().toISOString();
    return doc;
  }
}

export const knowledgeService = new KnowledgeService();
