import axios from 'axios';

export interface PosSaleReceipt {
  receiptNo: string;
  businessName: string;
  items: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
  totalAmount: number;
  cashGiven: number;
  changeGiven: number;
  dateTime: string;
}

function isConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM
  );
}

function formatReceiptMessage(receipt: PosSaleReceipt): string {
  const itemLines = receipt.items
    .map((i) => `  • ${i.name} x${i.quantity} @ GHS ${i.unitPrice.toFixed(2)} = GHS ${i.lineTotal.toFixed(2)}`)
    .join('\n');
  return [
    `*${receipt.businessName}*`,
    `Receipt: ${receipt.receiptNo}`,
    `Date: ${receipt.dateTime}`,
    '',
    '*Items:*',
    itemLines,
    '',
    `*Total: GHS ${receipt.totalAmount.toFixed(2)}*`,
    `Cash Given: GHS ${receipt.cashGiven.toFixed(2)}`,
    `Change: GHS ${receipt.changeGiven.toFixed(2)}`,
    '',
    'Thank you for your purchase!',
  ].join('\n');
}

function normalizePhone(phone: string): string {
  let p = phone.trim();
  // Ghana: 10-digit number starting with 0 → +233XXXXXXXXX
  if (/^0\d{9}$/.test(p)) {
    p = '+233' + p.slice(1);
  }
  return p;
}

export async function sendWhatsAppReceipt(
  customerPhone: string,
  receipt: PosSaleReceipt
): Promise<boolean> {
  if (!isConfigured()) {
    console.warn('[WhatsApp] Twilio not configured — skipping WhatsApp receipt.');
    return false;
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_WHATSAPP_FROM!; // e.g. whatsapp:+14155238886

  const normalized = normalizePhone(customerPhone);
  const to = normalized.startsWith('whatsapp:') ? normalized : `whatsapp:${normalized}`;

  try {
    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      new URLSearchParams({
        From: from,
        To: to,
        Body: formatReceiptMessage(receipt),
      }).toString(),
      {
        auth: { username: sid, password: token },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 8000,
      }
    );
    console.log(`[WhatsApp] Receipt sent to ${to} for ${receipt.receiptNo}`);
    return true;
  } catch (err: any) {
    console.error(`[WhatsApp] Failed to send receipt to ${to}:`, err?.response?.data || err.message);
    return false;
  }
}
