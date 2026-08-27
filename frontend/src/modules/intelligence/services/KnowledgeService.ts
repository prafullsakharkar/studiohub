import { ApiClient } from '@/api/client/ApiClient';
import {
  KnowledgeDocument,
  KnowledgeEntityRelationship,
} from '@/types/intelligence';

class KnowledgeService {
  private api = new ApiClient('/api/v1');

  async getDocuments(params?: {
    category?: string;
    department?: string;
    projectCode?: string;
    tag?: string;
    search?: string;
  }): Promise<KnowledgeDocument[]> {
    const response = await this.api.get<KnowledgeDocument[]>('/intelligence/knowledge/', { params });
    return response;
  }

  async getDocument(id: string): Promise<KnowledgeDocument | undefined> {
    const response = await this.api.get<KnowledgeDocument>(`/intelligence/knowledge/${id}/`);
    return response;
  }

  async createDocument(
    docData: Omit<KnowledgeDocument, 'id' | 'created_at' | 'updated_at' | 'views_count' | 'likes_count'>
  ): Promise<KnowledgeDocument> {
    const response = await this.api.post<KnowledgeDocument>('/intelligence/knowledge/', docData);
    return response;
  }

  async updateDocument(id: string, updates: Partial<KnowledgeDocument>): Promise<KnowledgeDocument> {
    const response = await this.api.patch<KnowledgeDocument>(`/intelligence/knowledge/${id}/`, updates);
    return response;
  }

  async deleteDocument(id: string): Promise<void> {
    await this.api.delete(`/intelligence/knowledge/${id}/`);
  }

  async toggleLike(id: string): Promise<number> {
    const response = await this.api.post<{ likes_count: number }>(`/intelligence/knowledge/${id}/like/`);
    return response.likes_count;
  }

  async linkEntity(docId: string, link: Omit<KnowledgeEntityRelationship, 'id'>): Promise<KnowledgeDocument> {
    const response = await this.api.post<KnowledgeDocument>(`/intelligence/knowledge/${docId}/link-entity/`, link);
    return response;
  }

  async unlinkEntity(docId: string, linkId: string): Promise<KnowledgeDocument> {
    const response = await this.api.delete<KnowledgeDocument>(`/intelligence/knowledge/${docId}/link-entity/${linkId}/`);
    return response;
  }
}

export const knowledgeService = new KnowledgeService();
