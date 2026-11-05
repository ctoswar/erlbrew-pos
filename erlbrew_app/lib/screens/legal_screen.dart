import 'package:flutter/material.dart';

import '../legal/legal_documents.dart';
import '../theme/app_theme.dart';
import '../widgets/page_transitions.dart';

/// Terms / Privacy / Cookies, readable in-app. Every legal link in the app
/// opens this screen via [LegalScreen.show] (landing on the right document),
/// and the segmented control lets you switch between the documents.
class LegalScreen extends StatefulWidget {
  final LegalDoc initialDoc;

  const LegalScreen({super.key, this.initialDoc = LegalDoc.terms});

  static Future<void> show(
    BuildContext context, {
    LegalDoc doc = LegalDoc.terms,
  }) {
    return Navigator.of(context).push(
      fadeThrough(LegalScreen(initialDoc: doc)),
    );
  }

  @override
  State<LegalScreen> createState() => _LegalScreenState();
}

class _LegalScreenState extends State<LegalScreen> {
  late LegalDoc _doc = widget.initialDoc;

  @override
  Widget build(BuildContext context) {
    final document = kLegalDocuments[_doc]!;
    return Scaffold(
      appBar: AppBar(title: const Text('Legal & Privacy')),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
              child: SegmentedButton<LegalDoc>(
                segments: const [
                  ButtonSegment(value: LegalDoc.terms, label: Text('Terms')),
                  ButtonSegment(
                      value: LegalDoc.privacy, label: Text('Privacy')),
                  ButtonSegment(
                      value: LegalDoc.cookies, label: Text('Cookies')),
                ],
                selected: {_doc},
                onSelectionChanged: (selection) =>
                    setState(() => _doc = selection.first),
              ),
            ),
            Expanded(
              // AnimatedSwitcher so switching documents cross-fades instead
              // of snapping.
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 220),
                switchInCurve: Curves.easeOut,
                child: ListView(
                  key: ValueKey(_doc),
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                  children: [
                    const SizedBox(height: 8),
                    Text(
                      document.title,
                      style: Theme.of(context)
                          .textTheme
                          .headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      document.intro,
                      style: const TextStyle(
                        color: AppColors.slateGrey,
                        fontSize: 13,
                        height: 1.55,
                      ),
                    ),
                    const SizedBox(height: 20),
                    for (final section in document.sections) ...[
                      Text(
                        section.heading,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 14.5,
                          color: AppColors.espresso,
                        ),
                      ),
                      const SizedBox(height: 8),
                      for (final paragraph in section.paragraphs) ...[
                        Text(
                          paragraph,
                          style: const TextStyle(
                            color: AppColors.slateGrey,
                            fontSize: 13,
                            height: 1.6,
                          ),
                        ),
                        const SizedBox(height: 8),
                      ],
                      const SizedBox(height: 14),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
