// The legal fine print shown in-app — Terms of Service, Privacy Policy
// and Cookie Policy — written for Erlbrew Café's customer app (accounts,
// loyalty points, pickup orders and e-wallet checkout).
//
// Pure data: [LegalScreen] renders whatever is in [kLegalDocuments].

enum LegalDoc { terms, privacy, cookies }

/// One headed block of legal text.
class LegalSection {
  final String heading;
  final List<String> paragraphs;

  const LegalSection(this.heading, this.paragraphs);
}

/// A complete document: title, intro line and its sections.
class LegalDocument {
  final String title;
  final String intro;
  final List<LegalSection> sections;

  const LegalDocument({
    required this.title,
    required this.intro,
    required this.sections,
  });
}

const Map<LegalDoc, LegalDocument> kLegalDocuments = {
  LegalDoc.terms: LegalDocument(
    title: 'Terms of Service',
    intro:
        'Last updated November 2026. These terms cover your use of the Erlbrew '
        'Café customer app, including accounts, loyalty points and pickup '
        'orders.',
    sections: [
      LegalSection('1. Your account', [
        'You must be at least 13 years old to create an account. You agree to '
            'give us accurate, current information — your real name, a working '
            'email address, a mobile number you control, and a username that '
            'does not impersonate another person or business. You are '
            'responsible for keeping your password confidential and for '
            'everything done through your account.',
        'Usernames are provided on a first-come basis and must follow our '
            'format rules (3-20 letters, numbers or underscores). We may ask '
            'you to change a username, or reclaim an abandoned one, if it '
            'violates these terms or impersonates Erlbrew staff, brands or '
            'other customers.',
      ]),
      LegalSection('2. Loyalty points & rewards', [
        'Points are earned on qualifying purchases at participating Erlbrew '
            'branches. They have no cash value: they cannot be sold, '
            'transferred or exchanged for money, and they expire 24 months '
            'after your last qualifying activity.',
        'Rewards shown in the app are subject to availability. Erlbrew may '
            'adjust earn rates, reward pricing or program terms with '
            'reasonable notice shown in the app.',
      ]),
      LegalSection('3. Pickup orders & payment', [
        'Pickup orders are prepared for collection at the branch you choose '
            'during the selected window. Prices shown at checkout include '
            'applicable taxes.',
        'Payments made in the app are processed by our payment partners (such '
            'as PayMongo for GCash and QRPh). We do not store your card or '
            'e-wallet credentials on our servers. Refunds for defective or '
            'missing items are handled at the branch or by contacting '
            'support.',
      ]),
      LegalSection('4. Acceptable use', [
        'You agree not to misuse the app — no scraping, automated account '
            'creation, attempts to access other customers\' data, exploiting '
            'points bugs, or interfering with our services. We may suspend or '
            'close accounts that violate these terms or Philippine law.',
      ]),
      LegalSection('5. Disclaimers & liability', [
        'The app is provided "as is". While we work hard to keep menus, prices '
            'and rewards accurate, branch-level differences may occur. To the '
            'extent allowed by law, Erlbrew Café is not liable for indirect or '
            'consequential losses arising from your use of the app. Nothing '
            'here limits rights you have under mandatory Philippine consumer '
            'law.',
      ]),
      LegalSection('6. Changes & contact', [
        'We may update these terms from time to time; the current version is '
            'always available in the app. Continued use after an update means '
            'you accept the revised terms.',
        'Questions about these terms: legal@erlbrew.cafe, or ask at any '
            'Erlbrew branch counter.',
      ]),
    ],
  ),
  LegalDoc.privacy: LegalDocument(
    title: 'Privacy Policy',
    intro:
        'Last updated November 2026. This policy explains what personal data '
        'the Erlbrew Café app collects, why, and the choices you have. It '
        'follows the Philippines\' Data Privacy Act of 2012 (RA 10173).',
    sections: [
      LegalSection('What we collect', [
        'Account details you give us: first and last name, username, email '
            'address, mobile number and password — your password is stored '
            'only as a salted hash, never in readable form.',
        'Loyalty activity: points earned and redeemed, order history and '
            'totals. On web: the cookies and local storage needed to keep you '
            'signed in (see the Cookie Policy).',
      ]),
      LegalSection('Why we use it', [
        'To create and secure your account, process pickup orders and '
            'payments, keep your loyalty balance and tier correct, send '
            'transactional notices (order status, verification links), and '
            'improve the app. We do not sell your personal data and we do not '
            'use it for third-party advertising.',
      ]),
      LegalSection('Who we share it with', [
        'Only the processors needed to run the service: Firebase / Google '
            'Cloud (authentication), our POS backend (accounts, orders, '
            'points) and payment partners such as PayMongo (GCash / QRPh '
            'checkout). Each processes data only to deliver the service. We '
            'may also disclose data when required by law.',
      ]),
      LegalSection('Retention & your rights', [
        'We keep account data while your account is active, and loyalty '
            'history for 24 months after your last activity to preserve point '
            'expiry rules. You may request access to, correction of, or '
            'deletion of your data — and withdraw consent — by emailing '
            'privacy@erlbrew.cafe or asking at any branch. Deletion requests '
            'are completed within 30 days, except records we must keep for '
            'accounting or legal reasons.',
      ]),
      LegalSection('Children & contact', [
        'The app is not directed at children under 13 and we do not knowingly '
            'collect their data.',
        'Data protection questions: privacy@erlbrew.cafe — Erlbrew Café, '
            'Philippines.',
      ]),
    ],
  ),
  LegalDoc.cookies: LegalDocument(
    title: 'Cookie Policy',
    intro: 'Last updated November 2026. This policy covers cookies and browser '
        'storage (local storage) used by the Erlbrew Café web app.',
    sections: [
      LegalSection('What we use and why', [
        'Strictly necessary storage: an authentication token in your browser '
            'so you stay signed in between visits, and a record of your '
            'cookie-banner choice so we stop asking. Without these the app '
            'cannot keep you logged in.',
        'Preferences: your sign-in profile (name, username, points) is cached '
            'in local storage so the app opens instantly and works smoothly '
            'on slow connections.',
        'We do not use advertising cookies, cross-site trackers or third-party '
            'analytics scripts in the customer app.',
      ]),
      LegalSection('Your choices', [
        'You can accept the notice to continue, or clear cookies and site data '
            'at any time in your browser settings — clearing strictly '
            'necessary storage signs you out. Blocking all storage may '
            'prevent the app from working.',
        'On the mobile app, the same "keep you signed in" role is played by '
            'your device\'s secure storage rather than browser cookies.',
      ]),
      LegalSection('More information', [
        'See the Privacy Policy for how personal data is handled overall, or '
            'email privacy@erlbrew.cafe with any question about storage on '
            'your device.',
      ]),
    ],
  ),
};
