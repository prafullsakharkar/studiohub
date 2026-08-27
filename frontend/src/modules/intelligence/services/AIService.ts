import { ApiClient } from '@/api/client/ApiClient';
import {
  AIChatMessage,
  AIRiskItem,
  AITaskRecommendation,
  AIProjectSummary,
  AIShotSummary,
  AIPermissionContext,
} from '@/types/intelligence';

class AIService {
  private api = new ApiClient('/api/v1');

  async getChatHistory(): Promise<AIChatMessage[]> {
    const response = await this.api.get<AIChatMessage[]>('/intelligence/ai/chat/');
    return response;
  }

  async sendAssistantMessage(userQuery: string): Promise<AIChatMessage> {
    const response = await this.api.post<AIChatMessage>('/intelligence/ai/chat/', { content: userQuery, query: userQuery });
    return response;
  }

  async getRisks(): Promise<AIRiskItem[]> {
    const response = await this.api.get<AIRiskItem[]>('/intelligence/ai/risks/');
    return response;
  }

  async resolveRisk(riskId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.api.post<{ success: boolean; message: string }>('/intelligence/ai/risks/resolve/', {
      risk_id: riskId,
    });
    return response;
  }

  async getTaskRecommendations(): Promise<AITaskRecommendation[]> {
    const response = await this.api.get<AITaskRecommendation[]>('/intelligence/ai/task-recommendations/');
    return response;
  }

  async applyTaskRecommendation(
    rec: AITaskRecommendation
  ): Promise<{ success: boolean; message: string }> {
    const response = await this.api.post<{ success: boolean; message: string }>(
      '/intelligence/ai/task-recommendations/apply/',
      rec
    );
    return response;
  }

  async getProjectSummary(projectCode: string): Promise<AIProjectSummary> {
    const response = await this.api.get<AIProjectSummary>(`/intelligence/ai/project-summary/${projectCode}/`);
    return response;
  }

  async getShotSummary(shotCode: string): Promise<AIShotSummary> {
    const response = await this.api.get<AIShotSummary>(`/intelligence/ai/shot-summary/${shotCode}/`);
    return response;
  }

  async getPermissionContext(): Promise<AIPermissionContext> {
    const response = await this.api.get<AIPermissionContext>('/intelligence/ai/permission-context/');
    return response;
  }

  async clearChat(): Promise<void> {
    await this.api.delete('/intelligence/ai/chat/');
  }
}

export const aiService = new AIService();
