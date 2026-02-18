import { useMemo } from 'react';
import { computeAnalytics, filterTradesByPeriod, computeModelStats, type Trade, type Analytics } from '@/utils/calculators';

export function useAnalytics(
  strategyHistory: Trade[],
  tags: string[],
  perfPeriod: string,
  selectedModelTags: string[]
) {
  const periodTrades = useMemo(
    () => filterTradesByPeriod(strategyHistory, perfPeriod),
    [strategyHistory, perfPeriod]
  );

  const analytics: Analytics = useMemo(
    () => computeAnalytics(periodTrades, strategyHistory, tags),
    [periodTrades, strategyHistory, tags]
  );

  const modelStats = useMemo(
    () => computeModelStats(strategyHistory, selectedModelTags),
    [strategyHistory, selectedModelTags]
  );

  return { analytics, periodTrades, modelStats };
}
