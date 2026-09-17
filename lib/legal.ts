export const LEGAL_EFFECTIVE_DATE = "17 September 2026";
export const LEGAL_CONTACT_EMAIL = process.env.LEGAL_CONTACT_EMAIL?.trim() || "support@fly-tally.com";
export const LEGAL_OPERATOR_NAME = process.env.LEGAL_OPERATOR_NAME?.trim() || "FlyTally private beta";
export const LEGAL_OPERATOR_ADDRESS = process.env.LEGAL_OPERATOR_ADDRESS?.trim() || "Operator identification pending before public commercial launch";
export const LEGAL_OPERATOR_ID = process.env.LEGAL_OPERATOR_ID?.trim() || "Private beta — not yet published";

export type LegalDocumentKey = "privacy" | "terms" | "cookies" | "aviation-safety" | "subprocessors" | "report";
export type LegalSection = Readonly<{ heading: string; paragraphs: readonly string[] }>;
export type LegalDocument = Readonly<{ title: string; summary: string; sections: readonly LegalSection[] }>;

export const legalDocuments: Record<LegalDocumentKey, LegalDocument> = {
  privacy: {
    title: "Privacy notice",
    summary: "How FlyTally handles account, logbook, flight-track and security data during the private beta.",
    sections: [
      { heading: "Controller and contact", paragraphs: [
        `${LEGAL_OPERATOR_NAME} is responsible for the FlyTally private-beta service. Contact: ${LEGAL_CONTACT_EMAIL}.`,
        `Operator address: ${LEGAL_OPERATOR_ADDRESS}. Operator registration/ID: ${LEGAL_OPERATOR_ID}. Formal operator identification is a release blocker before a public commercial launch.`,
      ]},
      { heading: "Data we process", paragraphs: [
        "FlyTally processes account and authentication data, pilot-profile and licence data you choose to enter, flight and aircraft records, GPS tracks you import, signatures and certification audit data, sharing preferences, support communications, and limited security/session metadata.",
        "A public flight share exposes only the fields you deliberately select. Private remarks, licence data, costs, signatures, certification details and crew identity are excluded from the public share payload.",
      ]},
      { heading: "Why and on what basis", paragraphs: [
        "Account, logbook, export, sharing and support data are processed to provide the service you request. Security and abuse-prevention metadata are processed to protect FlyTally, its users and records. Optional marketing or non-essential tracking is not part of the current private-beta design.",
        "Where consent is legally required for a future optional feature, that feature must remain disabled until valid consent is obtained.",
      ]},
      { heading: "Recipients and international processing", paragraphs: [
        "FlyTally uses specialist service providers for hosting, database infrastructure, email delivery, identity, maps and related operations. The current provider register is published in the Subprocessors notice.",
        "Where a provider processes data outside the EEA, FlyTally requires an applicable transfer mechanism or other lawful safeguard before production use.",
      ]},
      { heading: "Retention and your rights", paragraphs: [
        "Core logbook records are retained while your account is active because continuity is a primary purpose of the service. Security/session records, revoked share metadata and support records use shorter retention periods documented in the internal retention schedule.",
        `During private beta, requests for access, correction, portability, restriction or deletion can be sent to ${LEGAL_CONTACT_EMAIL}. Identity may be verified before a request is fulfilled. Some records may need to be retained where law or the integrity of an aviation record requires it.`,
      ]},
    ],
  },
  terms: {
    title: "Private beta terms",
    summary: "Rules for using FlyTally while the service remains invitation-only and non-commercial.",
    sections: [
      { heading: "Private beta", paragraphs: [
        "FlyTally is currently an invitation-only beta. Features, formats and availability may change as the service is tested and hardened.",
        "These beta terms do not remove rights that cannot lawfully be excluded. Commercial consumer terms will be introduced before any paid public service is offered.",
      ]},
      { heading: "Your account and records", paragraphs: [
        "Keep your credentials secure and enter or import only data you are entitled to use. You remain responsible for checking the accuracy, completeness and regulatory suitability of records before relying on, signing or submitting them.",
        "FlyTally must not be used to falsify flight time, qualifications, signatures, aircraft records or any other regulated record.",
      ]},
      { heading: "Aviation use", paragraphs: [
        "FlyTally is a recordkeeping and training-support platform, not an aviation authority. A feature being labelled EASA, ULL or compliant does not mean it has been approved by EASA, the Czech CAA, LAA ČR or another authority unless FlyTally expressly publishes that approval and its scope.",
        "Electronic attestations inside FlyTally are not represented as qualified electronic signatures. Where an authority requires a printed, handwritten, advanced or qualified signature workflow, that requirement remains applicable.",
      ]},
      { heading: "Public sharing", paragraphs: [
        "Creating a public share link makes the selected flight fields accessible to anyone who receives the secret URL. You must not publish another person’s personal data, confidential information or content you do not have the right to share.",
        "Public links can be revoked. FlyTally may disable a share where reasonably necessary to address privacy, safety, intellectual-property or unlawful-content concerns.",
      ]},
      { heading: "Availability and liability", paragraphs: [
        "The private beta is provided for evaluation and may be unavailable or contain defects. FlyTally does not replace required original records, current approved aircraft documentation, operator procedures, competent instruction or regulatory verification.",
        "Nothing in these terms excludes or limits liability where doing so is prohibited by applicable law.",
      ]},
    ],
  },
  cookies: {
    title: "Cookies & local storage",
    summary: "FlyTally currently uses storage required to sign you in, keep the application working and support offline-capable features.",
    sections: [
      { heading: "Essential storage", paragraphs: [
        "The Logbook uses a secure session cookie to keep an authenticated session. It is configured as HttpOnly, Secure in production and SameSite=Lax. Authentication flows may also use short-lived state needed to prevent login attacks.",
        "FlyTally Training may use browser storage and service-worker caches for progress, preferences and explicitly prepared offline flight-deck content. These mechanisms are functional parts of the requested service.",
      ]},
      { heading: "No non-essential tracking by default", paragraphs: [
        "The current private-beta design does not require advertising cookies or third-party behavioural analytics. For that reason FlyTally does not display a consent banner merely for essential technical storage.",
        "If non-essential analytics, advertising or comparable tracking is introduced, it must be blocked until any consent required by law has been obtained, and withdrawing or refusing consent must be straightforward.",
      ]},
    ],
  },
  "aviation-safety": {
    title: "Aviation & training safety notice",
    summary: "What FlyTally can assist with, and what remains authoritative in real-world aviation operations.",
    sections: [
      { heading: "Logbook", paragraphs: [
        "FlyTally helps structure and export pilot records. The pilot remains responsible for ensuring the record meets the requirements of the competent authority, licence scheme, operator and intended submission.",
        "No statement in the interface should be read as regulatory approval unless an approval and its exact scope are expressly identified.",
      ]},
      { heading: "Training and flight-deck reference", paragraphs: [
        "FlyTally Training is a supplemental training and reference aid. It is not an AFM, POH, QRH, MEL, approved checklist, operational flight plan, operator manual or substitute for current approved aircraft documentation and qualified instruction.",
        "Operational calculations must remain inside the published source envelope. FlyTally must not extrapolate, invent missing values or apply an interpolation method that the governed source dataset has not explicitly authorised.",
      ]},
      { heading: "Source authority", paragraphs: [
        "Aircraft applicability, document revision and source provenance matter. If the aircraft configuration or source authority is ambiguous, stale or incomplete, the safe behaviour is to withhold an operational result rather than infer one.",
      ]},
    ],
  },
  subprocessors: {
    title: "Service providers",
    summary: "Core external services used by FlyTally and the purpose for which they are used.",
    sections: [
      { heading: "Current provider register", paragraphs: [
        "Vercel — application hosting, delivery and server-side execution. Neon — PostgreSQL database infrastructure. Resend — transactional email delivery. Google — optional Google sign-in. Esri / ArcGIS — map and imagery services. OpenAI — Training admin-side source-grounded drafting where enabled.",
        "Provider use is purpose-limited. API keys and database credentials remain server-side. The internal processor register tracks DPA/transfer review and must be updated before adding a new production processor.",
      ]},
      { heading: "Changes", paragraphs: [
        "The provider list may change as FlyTally evolves. Material changes that affect privacy will be reflected here and in the Privacy notice.",
      ]},
    ],
  },
  report: {
    title: "Report privacy, content or IP concerns",
    summary: "A direct route for concerns about a public flight share, personal data, copyright or unlawful content.",
    sections: [
      { heading: "How to report", paragraphs: [
        `Email ${LEGAL_CONTACT_EMAIL} with the public FlyTally URL, the reason for the report, and enough information for the concern to be assessed. Do not send identity documents unless FlyTally specifically asks for them.`,
        "Reports concerning immediate account compromise should clearly state SECURITY in the subject. Public shares can be disabled while a credible privacy, rights or unlawful-content concern is reviewed.",
      ]},
      { heading: "What happens next", paragraphs: [
        "FlyTally records the minimum information needed to assess the report, may contact the account holder where appropriate, and documents the outcome. A report does not automatically establish that content is unlawful or infringes a right.",
      ]},
    ],
  },
};

export const legalDocumentKeys = Object.keys(legalDocuments) as LegalDocumentKey[];
