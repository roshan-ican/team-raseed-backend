import { ReceiptDocument } from "../models/Receipt";


export function summarizeReceiptForEmbedding(receipt: ReceiptDocument): string {
  const itemList: string[] = [];

  for (const [category, items] of Object.entries(receipt.categorization.categories)) {
    const itemSummary = items.map(item =>
      `${item.name} (${item.quantity} x ${item.price})`
    ).join(', ');
    itemList.push(`${category}: ${itemSummary}`);
  }

  const itemsSummary = itemList.join(' | ');

  const dateStr = receipt.receiptDate?.toDate().toDateString() || 'Unknown Date';

  return `Merchant: ${receipt.vendor || 'Unknown'}, Date: ${dateStr}, Items: ${itemsSummary}, Total: ${receipt.total ?? 'N/A'} ${receipt.currency}`;
}