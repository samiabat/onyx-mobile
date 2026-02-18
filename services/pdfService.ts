import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import type { Trade, Analytics } from '@/utils/calculators';

async function processTradeImages(trade: Trade, notePrefix?: string): Promise<string> {
  let htmlImages = '';
  if (trade.journal) {
    for (const entry of trade.journal) {
      if (entry.imageUris && entry.imageUris.length > 0) {
        for (const uri of entry.imageUris) {
          try {
            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
            htmlImages += `<div class="img-container"><img src="data:image/jpeg;base64,${base64}" /></div>`;
          } catch (e) {}
        }
      }
      if (entry.note) {
        if (notePrefix) {
          htmlImages += `<p class="note"><strong>${entry.type}:</strong> ${entry.note}</p>`;
        } else {
          htmlImages += `<p class="note">"${entry.note}"</p>`;
        }
      }
    }
  }
  return htmlImages;
}

export async function generatePlaybookPDF(
  strategyHistory: Trade[],
  profileName: string
): Promise<void> {
  const winners = strategyHistory.filter(t => t.realizedProfit > 0);
  let content = '';
  for (const t of winners) {
    const images = await processTradeImages(t);
    content += `<div class="page"><div class="trade-header"><h2>${t.direction} on ${t.dateStr}</h2><div class="stats">Risk: $${t.risk} | Profit: $${t.realizedProfit.toFixed(2)}</div></div><div class="tags">${(t.tags || []).map(tg => `<span class="tag">${tg}</span>`).join(' ')}</div><div class="content">${images}</div></div>`;
  }
  const html = `<html><head><style>body { font-family: 'Helvetica Neue', Helvetica, sans-serif; padding: 40px; color: #111; } .page { page-break-after: always; margin-bottom: 50px; } .trade-header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: baseline; } h1 { font-size: 36px; margin-bottom: 50px; text-align: center; } h2 { margin: 0; font-size: 24px; } .stats { font-weight: bold; color: #10B981; } .tag { background: #000; color: #fff; padding: 4px 8px; font-size: 10px; border-radius: 4px; display: inline-block; margin-right: 5px; text-transform: uppercase; letter-spacing: 1px; } img { max-width: 100%; border: 1px solid #ddd; margin-bottom: 10px; } .note { background: #f4f4f5; padding: 15px; font-style: italic; border-left: 4px solid #333; margin: 10px 0; }</style></head><body><h1>${profileName}'s PLAYBOOK</h1>${content || '<p style="text-align:center">No winning trades documented yet.</p>'}</body></html>`;
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
}

export async function generateDetailedPDF(
  periodTrades: Trade[],
  profileName: string,
  perfPeriod: string,
  strategyName: string,
  analytics: Analytics
): Promise<void> {
  let tradesHtml = '';
  for (const t of periodTrades) {
    const imagesHtml = await processTradeImages(t, 'prefix');
    tradesHtml += `<div class="trade-block"><div class="trade-header"><span>${t.dateStr} - ${t.direction}</span><span class="${t.realizedProfit >= 0 ? 'win' : 'loss'}">${t.realizedProfit >= 0 ? '+' : ''}$${t.realizedProfit.toFixed(2)}</span></div><div class="trade-meta">Strategy: ${strategyName} | Risk: $${t.risk} | Status: ${t.status}</div><div class="tags">${(t.tags || []).map(tg => `<span class="tag">${tg}</span>`).join('')}</div><div class="journal-entries">${imagesHtml}</div></div>`;
  }
  const html = `<html><head><style>body { font-family: Helvetica, sans-serif; padding: 40px; color: #333; } .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px; } h1 { margin: 0; font-size: 32px; letter-spacing: 2px; } .sub-header { color: #666; font-size: 14px; margin-top: 10px; } .stats-grid { display: flex; gap: 20px; margin-bottom: 40px; justify-content: center; } .card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; width: 22%; text-align: center; } .label { font-size: 10px; color: #666; text-transform: uppercase; } .value { font-size: 20px; font-weight: bold; margin-top: 5px; } .trade-block { border: 1px solid #eee; margin-bottom: 20px; page-break-inside: avoid; border-radius: 8px; overflow: hidden; } .trade-header { background: #f9f9f9; padding: 10px 15px; display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; border-bottom: 1px solid #eee; } .trade-meta { padding: 10px 15px; font-size: 12px; color: #666; } .tags { padding: 0 15px; margin-bottom: 10px; } .tag { background: #eee; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 4px; } .journal-entries { padding: 15px; } .img-container { text-align: center; margin-bottom: 10px; } img { max-width: 100%; max-height: 300px; border-radius: 4px; border: 1px solid #ddd; } .note { font-size: 13px; font-style: italic; background: #fffbe6; padding: 10px; border-radius: 4px; border-left: 3px solid #ffe58f; margin: 10px 0; } .win { color: #10B981; } .loss { color: #F43F5E; }</style></head><body><div class="header"><h1>ONYX PERFORMANCE</h1><p class="sub-header">Trader: ${profileName} | Period: ${perfPeriod}</p></div><div class="stats-grid"><div class="card"><p class="label">Net Profit</p><p class="value" style="color: ${analytics.netProfit >= 0 ? '#10B981' : '#F43F5E'}">$${analytics.netProfit.toFixed(2)}</p></div><div class="card"><p class="label">Win Rate</p><p class="value">${analytics.winRate.toFixed(1)}%</p></div><div class="card"><p class="label">Profit Factor</p><p class="value">${analytics.profitFactor}</p></div><div class="card"><p class="label">Total Trades</p><p class="value">${analytics.totalTrades}</p></div></div><h2>Detailed Execution Log</h2>${tradesHtml}</body></html>`;
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
}
