import { db } from '@/lib/core/db';
import { useSettingsStore } from '@/lib/stores/settingsStore';

export interface RecommendationRequest {
  history: any[];
  inventory: any[];
}

export interface RecommendationResponse {
  beanId: string;
  theme?: string;
  reason: string;
  luckyMessage: string;
}

export async function getDailyRecommendation(
  history: any[],
  inventory: any[]
): Promise<RecommendationResponse> {
  const { settings } = useSettingsStore.getState();
  const activeProviderId = settings.aiSettings?.activeProviderId;
  const featureBinding = settings.aiSettings?.featureBindings?.dailyRecommendation;
  
  // Determine which provider to use
  // Priority: Feature Binding Provider -> Active Provider
  const providerIdToUse = featureBinding?.providerId || activeProviderId;
  const providerToUse = settings.aiSettings?.providers.find(p => p.id === providerIdToUse);

  let aiConfigHeader = null;
  if (providerToUse) {
    const config = {
      apiKey: providerToUse.settings.apiKey,
      apiHost: providerToUse.settings.apiHost,
      // Priority: Feature Binding Model -> Provider Default Model -> First Model
      model: featureBinding?.modelId || providerToUse.settings.models?.[0]?.modelId,
      type: providerToUse.type,
      // Custom Prompt
      prompt: featureBinding?.prompt
    };
    aiConfigHeader = encodeURIComponent(JSON.stringify(config));
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (aiConfigHeader) {
    headers['x-ai-config'] = aiConfigHeader;
  }

  const response = await fetch('/api/recommend-bean', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      history,
      inventory,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get recommendation');
  }

  const result = await response.json();
  if (result.success && result.data) {
    return result.data;
  }
  
  throw new Error('Invalid response format');
}
