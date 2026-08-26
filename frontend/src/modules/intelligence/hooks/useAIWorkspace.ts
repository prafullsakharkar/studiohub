import { useState, useEffect, useCallback } from 'react';
import {
  AIChatMessage,
  AIRiskItem,
  AITaskRecommendation,
  AIProjectSummary,
  AIShotSummary,
  AIPermissionContext,
} from '@/types/intelligence';
import { aiService } from '../services/AIService';

export function useAIWorkspace() {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [risks, setRisks] = useState<AIRiskItem[]>([]);
  const [taskRecommendations, setTaskRecommendations] = useState<AITaskRecommendation[]>([]);
  const [activeProjectSummary, setActiveProjectSummary] = useState<AIProjectSummary | null>(null);
  const [activeShotSummary, setActiveShotSummary] = useState<AIShotSummary | null>(null);
  const [permissionContext, setPermissionContext] = useState<AIPermissionContext | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [history, currentRisks, recs, pSummary, sSummary, perm] = await Promise.all([
        aiService.getChatHistory(),
        aiService.getRisks(),
        aiService.getTaskRecommendations(),
        aiService.getProjectSummary('NK99'),
        aiService.getShotSummary('NK99_010_010'),
        aiService.getPermissionContext(),
      ]);
      setMessages(history);
      setRisks(currentRisks);
      setTaskRecommendations(recs);
      setActiveProjectSummary(pSummary);
      setActiveShotSummary(sSummary);
      setPermissionContext(perm);
    } catch (err) {
      console.error('Failed to load AI intelligence data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;
    setIsThinking(true);
    try {
      const aiResponse = await aiService.sendAssistantMessage(content);
      const updatedHistory = await aiService.getChatHistory();
      setMessages(updatedHistory);
      return aiResponse;
    } catch (err) {
      console.error('AI assistant error:', err);
    } finally {
      setIsThinking(false);
    }
  };

  const resolveRisk = async (riskId: string) => {
    const result = await aiService.resolveRisk(riskId);
    setRisks((prev) => prev.filter((r) => r.id !== riskId));
    return result;
  };

  const applyRecommendation = async (rec: AITaskRecommendation) => {
    const result = await aiService.applyTaskRecommendation(rec);
    setTaskRecommendations((prev) => prev.filter((r) => r.task_id !== rec.task_id));
    return result;
  };

  const loadProjectSummary = async (projectCode: string) => {
    const summary = await aiService.getProjectSummary(projectCode);
    setActiveProjectSummary(summary);
    return summary;
  };

  const loadShotSummary = async (shotCode: string) => {
    const summary = await aiService.getShotSummary(shotCode);
    setActiveShotSummary(summary);
    return summary;
  };

  const clearChat = async () => {
    await aiService.clearChat();
    const history = await aiService.getChatHistory();
    setMessages(history);
  };

  return {
    messages,
    risks,
    taskRecommendations,
    activeProjectSummary,
    activeShotSummary,
    permissionContext,
    isThinking,
    loading,
    sendMessage,
    resolveRisk,
    applyRecommendation,
    loadProjectSummary,
    loadShotSummary,
    clearChat,
  };
}
