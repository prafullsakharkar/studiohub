import {
  AIChatMessage,
  AIRiskItem,
  AITaskRecommendation,
  AIProjectSummary,
  AIShotSummary,
  AIPermissionContext,
} from '@/types/intelligence';
import {
  mockAIRisks,
  mockAITaskRecommendations,
  mockAIProjectSummaries,
  mockAIShotSummaries,
  mockInitialAIChatMessages,
  mockAIPermissionContext,
} from '@/mocks/db/intelligence/ai';
import { mockKnowledgeDocuments } from '@/mocks/db/intelligence/knowledge';

class AIService {
  private risks: AIRiskItem[] = [...mockAIRisks];
  private taskRecommendations: AITaskRecommendation[] = [...mockAITaskRecommendations];
  private chatHistory: AIChatMessage[] = [...mockInitialAIChatMessages];

  async getChatHistory(): Promise<AIChatMessage[]> {
    return [...this.chatHistory];
  }

  async sendAssistantMessage(userQuery: string): Promise<AIChatMessage> {
    const userMsg: AIChatMessage = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      content: userQuery,
      timestamp: new Date().toISOString(),
    };
    this.chatHistory.push(userMsg);

    // Artificial thinking delay
    await new Promise((r) => setTimeout(r, 450));

    const q = userQuery.toLowerCase();
    let responseText = '';
    let followups: string[] = [];
    let citations: any[] = [];
    let capabilityUsed: any = 'production_assistant';
    let structuredData: any = null;

    if (q.includes('summary') || q.includes('status') || q.includes('nk99') || q.includes('dune')) {
      const pCode = q.includes('dune') ? 'DUNE' : 'NK99';
      const summary = mockAIProjectSummaries[pCode] || mockAIProjectSummaries.NK99;
      capabilityUsed = 'project_summary';
      structuredData = summary;
      responseText = `### Executive Summary for **[${summary.project_code}] ${summary.project_name}**
**Health Score**: ${summary.health_score}/100 (${summary.status.toUpperCase().replace(/_/g, ' ')})

${summary.headline}

${summary.executive_brief}

#### Key Metrics
- **Approved Shots**: ${summary.key_metrics.shots_completed} / ${summary.key_metrics.shots_total} (${summary.key_metrics.completion_percentage}%)
- **Delivery Countdown**: ${summary.key_metrics.days_to_final_delivery} days remaining
- **Budget Burn Rate**: ${summary.key_metrics.budget_burn_rate_pct}%`;

      followups = [
        `What are the critical risks for [${pCode}]?`,
        `Show department breakdown for [${pCode}]`,
        `Recommend task reallocations to prevent delays`,
      ];
    } else if (q.includes('risk') || q.includes('delay') || q.includes('slip') || q.includes('bottleneck')) {
      capabilityUsed = 'risk_detection';
      const criticalRisks = this.risks.filter((r) => r.severity === 'critical' || r.severity === 'high');
      structuredData = this.risks;
      responseText = `I have scanned the active production graph and detected **${this.risks.length} active risks** across scheduling, capacity, and delivery:

1. **[CRITICAL] Sequence 010 Comp Slip**: 4.5 days forecasted delay due to FX pyro simulation queue backlog.
2. **[HIGH] Artist Overbooking**: Maya Lindqvist (Senior Animator) allocated at 145% weekly capacity (58 hours).
3. **[HIGH] Delivery QA Warning**: Aspera package \`del-001\` requires CineCode watermark verification.

*Would you like me to auto-mitigate the artist overbooking or rebalance the render queue priority?*`;

      followups = [
        'Apply auto-mitigation for Maya Lindqvist overbooking',
        'Analyze FX render farm queue congestion',
        'Show full risk matrix with confidence scores',
      ];
    } else if (q.includes('usd') || q.includes('openusd') || q.includes('payload') || q.includes('layer')) {
      capabilityUsed = 'knowledge_qa';
      const doc = mockKnowledgeDocuments.find((d) => d.id === 'kdoc-001');
      if (doc) {
        citations.push({
          doc_id: doc.id,
          title: doc.title,
          snippet: doc.summary,
        });
      }
      responseText = `Based on the **OpenUSD 24.08 Multi-Department Asset Composition Standard**:

1. **Root Hierarchy**: Author all asset prims under a single default root primitive in PascalCase with \`metersPerUnit = 0.01\` and \`upAxis = "Y"\`.
2. **Payload Conventions**: High-density poly meshes (>500k polygons) must be authored inside \`_payload.usd\` to enable instant viewport layout loading.
3. **MaterialX Standard**: Shader graphs must target \`UsdPreviewSurface\` or \`MaterialX 1.38\` for Karma and Unreal Engine 5.5 parity.`;

      followups = [
        'Open the full OpenUSD 24.08 SOP Document',
        'What are the Deep EXR compositing requirements?',
        'Show assets linked to this USD guideline',
      ];
    } else if (q.includes('shot') || q.includes('010') || q.includes('asteroid')) {
      capabilityUsed = 'shot_summary';
      const shot = mockAIShotSummaries.NK99_010_010;
      structuredData = shot;
      responseText = `### Shot Intelligence: **${shot.shot_code}**
- **Pipeline Stage**: ${shot.pipeline_stage}
- **Frame Range**: ${shot.frame_range}
- **Supervisor Intent**: ${shot.supervisor_intent}
- **Latest Feedback**: ${shot.latest_review_feedback}
- **Blockers**: ${shot.blocker_analysis}
- **Forecasted Turnaround**: ${shot.turnaround_forecast_days} days to supervisor final.`;

      followups = [
        'Open Shot NK99_010_010 in Workspace',
        'Assign Marcus Vance to final deep comp task',
        'Inspect upstream FX simulation cache versions',
      ];
    } else {
      responseText = `I processed your request using StudioHub's intelligence engine.

- **Active Organization**: ${mockAIPermissionContext.active_organization_name}
- **Active Show**: [${mockAIPermissionContext.active_project_code}]
- **Isolated Permissions**: RBAC Role: ${mockAIPermissionContext.user_role}

You can ask me to analyze shot turnaround forecasts, scan department risk anomalies, query studio SOP documentation, or draft turnover checklists.`;

      followups = [
        'Show portfolio project status',
        'Scan for delivery and schedule risks',
        'Search pipeline knowledge base',
      ];
    }

    const aiMsg: AIChatMessage = {
      id: `msg-${Date.now()}-assistant`,
      sender: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString(),
      capability_used: capabilityUsed,
      suggested_followups: followups,
      citations: citations.length > 0 ? citations : undefined,
      structured_data: structuredData,
    };
    this.chatHistory.push(aiMsg);
    return aiMsg;
  }

  async getRisks(): Promise<AIRiskItem[]> {
    await new Promise((r) => setTimeout(r, 40));
    return [...this.risks];
  }

  async resolveRisk(riskId: string): Promise<{ success: boolean; message: string }> {
    await new Promise((r) => setTimeout(r, 80));
    const risk = this.risks.find((r) => r.id === riskId);
    if (!risk) throw new Error('Risk not found');

    this.risks = this.risks.filter((r) => r.id !== riskId);
    return {
      success: true,
      message: `Risk "${risk.title}" mitigated: ${risk.suggested_action}`,
    };
  }

  async getTaskRecommendations(): Promise<AITaskRecommendation[]> {
    await new Promise((r) => setTimeout(r, 40));
    return [...this.taskRecommendations];
  }

  async applyTaskRecommendation(
    rec: AITaskRecommendation
  ): Promise<{ success: boolean; message: string }> {
    await new Promise((r) => setTimeout(r, 80));
    this.taskRecommendations = this.taskRecommendations.filter((t) => t.task_id !== rec.task_id);
    return {
      success: true,
      message: `Successfully reallocated "${rec.task_title}" to ${rec.recommended_assignee_name}. Saved ~${rec.estimated_speedup_days} days.`,
    };
  }

  async getProjectSummary(projectCode: string): Promise<AIProjectSummary> {
    await new Promise((r) => setTimeout(r, 40));
    return mockAIProjectSummaries[projectCode] || mockAIProjectSummaries.NK99;
  }

  async getShotSummary(shotCode: string): Promise<AIShotSummary> {
    await new Promise((r) => setTimeout(r, 40));
    return mockAIShotSummaries[shotCode] || mockAIShotSummaries.NK99_010_010;
  }

  async getPermissionContext(): Promise<AIPermissionContext> {
    return { ...mockAIPermissionContext };
  }

  async clearChat(): Promise<void> {
    this.chatHistory = [...mockInitialAIChatMessages];
  }
}

export const aiService = new AIService();
