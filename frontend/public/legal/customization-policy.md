# Customization Policy

**Effective Date:** 1 January 2025  
**Last Updated:** 1 September 2026

This Customization Policy describes what modifications, configurations, and integrations Ledgio Software ("Company") makes available to customers ("Subscriber") of the Ledgio accounting platform, and the rules that govern them.

---

## 1. Overview

Ledgio is designed to be adaptable to the specific accounting, payroll, and operational requirements of different businesses. Customization is available at the platform level (configuration by the Subscriber) and at the system level (modifications performed by Ledgio on request). The availability of specific customization options depends on the Subscriber's plan tier.

## 2. Self-Service Configuration

All Subscribers may configure the following without contacting Ledgio:

- **Chart of Accounts:** Add, edit, or deactivate account codes; set account types and default roles.
- **Tax Rates:** Define VAT, withholding tax (WHT), and other tax rates applicable to your jurisdiction.
- **Currencies:** Enable multi-currency support and set base currency.
- **Fiscal Year and Periods:** Configure fiscal year start date and reporting period structure.
- **User Roles and Permissions:** Create and assign roles (Admin, Accountant, HR, Viewer, etc.) within your tenant.
- **Cost Centres and Departments:** Define cost centres for management reporting.
- **Warehouses and Inventory Locations:** Set up multiple warehouses for stock management.
- **Email Notification Templates:** Customise the content of invoice, receipt, and reminder emails sent to customers.

## 3. Plan-Tier Features

| Feature | Shop (Tier 1) | Business (Tier 2) | Enterprise (Tier 3) |
|---|:---:|:---:|:---:|
| Chart of accounts customisation | ✓ | ✓ | ✓ |
| Custom tax rates | ✓ | ✓ | ✓ |
| Multi-currency | — | ✓ | ✓ |
| Payroll configuration | — | ✓ | ✓ |
| Cost centres | — | ✓ | ✓ |
| Custom email templates | — | ✓ | ✓ |
| REST API access | — | — | ✓ |
| Webhook integrations | — | — | ✓ |
| White-label branding | — | — | ✓ |
| Custom report templates | — | — | ✓ |
| Dedicated onboarding support | — | — | ✓ |
| Custom data retention periods | — | — | ✓ |

## 4. API and Webhook Integrations (Enterprise)

Enterprise Subscribers may integrate Ledgio with third-party systems via:

- **REST API:** Documented at https://api.ledgio.software/docs. API keys are managed in Settings → Integrations.
- **Webhooks:** Push real-time events (new invoice, payment received, payroll run completed, etc.) to a Subscriber-configured HTTPS endpoint.

**Rules:**
- API keys must be kept confidential and rotated immediately if compromised.
- Webhook endpoints must respond within 10 seconds; failed deliveries are retried up to 3 times with exponential backoff.
- API usage is subject to rate limits (documented in the API reference). Abuse may result in temporary suspension of API access.

## 5. White-Label Branding (Enterprise)

Enterprise Subscribers may upload their organisation's logo and set a primary brand colour. These appear on:

- Customer-facing invoices and receipts (PDF and email).
- The customer-facing payment portal.

White-labelling does not include modifying the Ledgio application URL or removing Ledgio attribution from internal system pages.

## 6. Custom Report Templates (Enterprise)

Ledgio will work with Enterprise Subscribers to build up to three (3) custom report templates per year as part of the Enterprise plan. Custom reports are developed by the Ledgio team and deployed to the Subscriber's tenant within 20 business days of requirements sign-off.

## 7. Managed Customisations

For customisations beyond what is listed above (e.g., custom workflows, additional integrations, bespoke modules), Subscriber must contact sales@ledgio.software to discuss a professional-services engagement. Managed customisations are governed by a separate Statement of Work and are not covered by this policy.

## 8. Restrictions

Customisation features may not be used to:

- Circumvent tenant isolation or access another tenant's data.
- Transmit malicious code via webhooks or API payloads.
- Create configurations that violate applicable accounting standards or regulatory requirements.
- Introduce integrations that exfiltrate Customer Data to unauthorised parties.

Violation of these restrictions may result in immediate suspension of customisation privileges or termination of the subscription.

## 9. Support for Customisations

Ledgio provides support for standard self-service configurations on all plans (subject to the SLA). Subscriber-developed custom integrations and third-party connectors are supported on a best-effort basis. Ledgio is not responsible for failures caused by third-party systems.

## 10. Changes to This Policy

We may update this policy to reflect new features or plan changes. We will notify Subscribers of material changes with at least 14 days' notice via email and in-app notification.

## 11. Contact

Ledgio Software — Sales & Integrations  
Email: sales@ledgio.software  
Documentation: https://docs.ledgio.software
