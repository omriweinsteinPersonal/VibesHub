# Privacy and consumer-protection review

Working engineering inventory as of October 30, 2026. This is not a legal opinion or
confirmation of compliance. Counsel must assess the actual business, applicable markets,
contracts, operational practices and legal documents before launch.

## Product and data flow

1. A creator signs in, creates a profile and publishes recommendations, images, videos,
   product links and optional discount codes. Published content is public. Account data,
   private application information and unpublished content require access controls.
2. A visitor can browse without a Swavii account. Web analytics use browser and session
   identifiers; the API stores keyed hashes rather than those raw identifiers in its
   analytics event records. Raw network addresses can be processed for security and rate
   limiting. The implementation also records certain outbound shop clicks on the server.
   These data and other provider logs can still be personal information; hashing does not
   itself establish legal anonymization.
3. A visitor may see a code, follow the creator's link and transact with a separate
   merchant. The merchant controls checkout and decides whether a code applies. Swavii
   does not itself confirm that a code works or that a purchase was completed. The
   destination and providers may collect information under their own notices.
4. A creator can declare an organic, affiliate, sponsored or gifted relationship. Public
   disclosures depend on the creator selecting the correct relationship. Existing data
   and future submissions require review; an organic default is not proof of no material
   connection. Terms alone do not replace clear disclosures at the recommendation.
5. Account deletion removes the Auth account and cascaded creator data. Blob cleanup is
   best-effort: a storage failure is logged after deletion and currently does not prevent
   account removal. Verify reconciliation and operational follow-up before representing
   removal as guaranteed. Shared media, logs, analytics and backups need separate review.

## Decisions and evidence required before legal sign-off

- Insert the sole proprietor's exact registered legal name and contact details in the
  notices; confirm the privacy and deletion contact mailbox receives and answers mail.
- Confirm where creators and shoppers are targeted, whether minors are in scope, and the
  applicable Israeli, EU/UK, US or other rules. The creator terms say 18+, while the
  registration flow does not currently ask for or verify age. Obtain advice on the
  appropriate notice, age safeguards and consent mechanisms for the actual audience.
- Inventory every processor and subprocessor, hosting region, international transfer,
  purpose, contractual safeguard and access to data. Verify actual configuration rather
  than treating a list of possible vendors as a completed record.
- Decide documented retention periods and deletion procedures for analytics events,
  event receipts, rate-limit records, media, backups, application records and security
  logs. The repository does not establish a complete operational retention schedule;
  confirm whether external jobs or provider policies exist before making claims. Do not
  deploy destructive deletion jobs without approving scope and retention periods.
- Assess whether analytics identifiers, cookies, security processing and international
  transfers require consent, opt-out, notices or another legal basis in each market.
  The current session query-parameter opt-out is not a general consent-management
  implementation and does not turn off server-authoritative outbound click records.
- Verify deletion, access, correction, objection and complaint handling end to end,
  including identity verification, realistic response times, failed blob cleanup,
  backups, processor requests and public/search-engine caches.
- Review creator and merchant agreements, product and offer accuracy, commercial
  disclosure rules, misleading endorsements, accessibility and complaint handling.
  Do not infer that every creator receives compensation or that a coupon alone makes
  the relationship clear. Investigate existing records where relationship data may have
  been saved as organic by an earlier web editor.
- Confirm database registration, notification, database definitions, security plan,
  outsourcing controls, incident response and any privacy-officer obligation against the
  actual processing volume and categories. Lack of a registration requirement does not
  remove other privacy and security duties.
- Before enabling creator subscriptions, review store billing disclosures, renewals,
  cancellation, refunds, tax, merchant-of-record terms and privacy notices. Current
  payment preparation must not be presented as evidence that production billing is live.

## Starting references for counsel

- [Israel Privacy Protection Authority: Amendment 13 guidance](https://govextra.gov.il/privacy-protection-regulations/privacy-protection-regulations/)
- [Israel Privacy Protection Authority: Amendment 13 questions and answers](https://www.gov.il/he/pages/tikun13_qa?chapterIndex=6)
- [FTC: endorsement and affiliate-disclosure guidance](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking)
- [GDPR, including territorial scope](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
