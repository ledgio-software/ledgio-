# Service Level Agreement (SLA)

**Effective Date:** 1 January 2025  
**Last Updated:** 1 September 2026

This Service Level Agreement ("SLA") is incorporated by reference into the Ledgio Terms and Conditions and defines the service availability commitments and remedies provided by Ledgio Software ("Company") to customers ("Subscriber") on active paid subscriptions.

---

## 1. Scope

This SLA applies to the Ledgio web application, REST API, and WebSocket services hosted at ledgio.software and its subdomains. It does not apply to:

- Features in beta or preview.
- Downtime caused by scheduled maintenance.
- Downtime caused by the Subscriber's own actions, integrations, or third-party services outside our control.
- Free-tier or trial accounts.

## 2. Availability Commitment

| Plan | Monthly Uptime Target |
|---|---|
| Shop (Tier 1) | 99.5% |
| Business (Tier 2) | 99.7% |
| Enterprise (Tier 3) | 99.9% |

**Monthly Uptime %** is calculated as:

```
Uptime % = ((Total Minutes in Month − Downtime Minutes) / Total Minutes in Month) × 100
```

"Downtime" means the Service is unavailable or returns errors for more than 1% of requests over any consecutive 5-minute window, as measured by our monitoring infrastructure.

## 3. Scheduled Maintenance

We will provide at least 48 hours' advance notice of scheduled maintenance windows. Scheduled maintenance does not count as Downtime. Routine maintenance is typically performed between 02:00–04:00 UTC on Sundays.

## 4. Service Credits

If we fail to meet the applicable uptime target in a calendar month, you are eligible for a service credit as follows:

| Actual Monthly Uptime | Credit (% of Monthly Fee) |
|---|---|
| 99.0% – < target | 10% |
| 95.0% – < 99.0% | 25% |
| < 95.0% | 50% |

Service credits are applied to the next invoice and are the sole remedy for availability failures. Credits are not refundable as cash.

## 5. How to Claim a Credit

Submit a credit request to support@ledgio.software within 14 days of the month end in which the incident occurred. Include the date, time, and duration of the outage and any error messages received. We will review and respond within 10 business days.

## 6. Support Response Times

| Severity | Description | Enterprise | Business | Shop |
|---|---|---|---|---|
| Critical (P1) | Service unavailable or data loss risk | 1 hour | 4 hours | Next business day |
| High (P2) | Major feature broken, no workaround | 4 hours | 8 hours | 2 business days |
| Medium (P3) | Feature degraded, workaround available | 1 business day | 2 business days | 5 business days |
| Low (P4) | General questions, feature requests | 2 business days | 5 business days | 7 business days |

Response times are measured in clock hours during our support hours: Monday–Friday, 08:00–18:00 GMT.

## 7. Data Backup

We perform daily automated backups of all customer data with a retention period of 30 days. Point-in-time recovery is available for Enterprise subscribers within a 7-day window. Backup restoration is performed on a best-effort basis and does not carry an SLA-backed recovery time objective (RTO) unless agreed separately in an enterprise contract.

## 8. Incident Communication

During a service incident we will:

1. Post a status update to https://status.ledgio.software within 30 minutes of detection.
2. Send email notifications to account administrators for incidents affecting their tenant.
3. Post a post-mortem report within 5 business days of resolution for P1 incidents.

## 9. Exclusions

This SLA does not apply to performance issues caused by:

- Internet connectivity problems outside our network.
- Third-party services (e.g., Paystack, email providers, GRA VSDC gateway).
- Subscriber-initiated actions, misuse, or violation of the Terms and Conditions.
- Force majeure events (natural disasters, government actions, pandemics).

## 10. Changes to This SLA

We may update this SLA with 30 days' written notice. If a change materially reduces your rights, you may terminate your subscription within 30 days of the notice and receive a pro-rata refund of prepaid fees.

## 11. Contact

Ledgio Software — Support  
Email: support@ledgio.software  
Status Page: https://status.ledgio.software
