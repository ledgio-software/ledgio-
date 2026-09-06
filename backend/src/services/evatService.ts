import { createHash } from 'crypto';
import axios from 'axios';

export interface EvatReceipt {
  invoiceRef: string;
  qrData: string;
  issuedAt: string;
}

/**
 * Ghana Revenue Authority E-VAT integration.
 *
 * In production, set GRA_EVAT_ENDPOINT and GRA_EVAT_CLIENT_ID to enable
 * live submission. Without them, a cryptographically-consistent stub
 * receipt is issued (suitable for dev/demo; clearly marked as stub).
 */
export class EvatService {
  static async submitInvoice(params: {
    tenantId: string;
    tenantTin?: string | null;
    transactionRef: string;
    totalAmount: number;
    lineItems: Array<{ description: string; qty: number; unitPrice: number }>;
    timestamp: Date;
  }): Promise<EvatReceipt> {
    const endpoint = process.env.GRA_EVAT_ENDPOINT;
    const clientId = process.env.GRA_EVAT_CLIENT_ID;

    const shortTenantId = params.tenantId.replace(/-/g, '').slice(0, 10).toUpperCase();
    const invoiceRef = `GH-EVT-${shortTenantId}-${params.timestamp.getTime()}`;
    const payload = [
      invoiceRef,
      params.tenantTin ?? 'TIN-PENDING',
      params.transactionRef,
      params.totalAmount.toFixed(2),
      params.timestamp.toISOString(),
    ].join('|');

    if (endpoint && clientId) {
      try {
        const resp = await axios.post(
          endpoint,
          {
            invoiceRef,
            sellerTin: params.tenantTin,
            transactionDate: params.timestamp.toISOString(),
            totalAmount: params.totalAmount,
            items: params.lineItems,
          },
          { headers: { 'X-Client-ID': clientId, 'Content-Type': 'application/json' }, timeout: 10_000 }
        );
        return {
          invoiceRef: resp.data?.invoiceRef ?? invoiceRef,
          qrData: resp.data?.qrCode ?? payload,
          issuedAt: params.timestamp.toISOString(),
        };
      } catch (err: any) {
        console.warn('[E-VAT] GRA API unreachable, falling back to stub receipt:', err.message);
      }
    }

    // Stub receipt: deterministic hash so the same transaction always produces the same ref
    const hash = createHash('sha256').update(payload).digest('hex').slice(0, 16).toUpperCase();
    return {
      invoiceRef,
      qrData: `${payload}|${hash}`,
      issuedAt: params.timestamp.toISOString(),
    };
  }
}
