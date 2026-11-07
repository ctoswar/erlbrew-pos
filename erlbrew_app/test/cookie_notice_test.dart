import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:erlbrew_app/main.dart';
import 'package:erlbrew_app/screens/legal_screen.dart';

void main() {
  testWidgets('cookie notice Learn more opens the legal screen',
      (WidgetTester tester) async {
    // First visit: no stored consent yet, so the notice renders.
    SharedPreferences.setMockInitialValues({});
    // The notice is otherwise web-only (kIsWeb); tests run on native.
    await tester.pumpWidget(const ErlbrewApp(forceCookieNotice: true));
    await tester.pump(); // flush async boot / notice checks
    await tester.pump(const Duration(milliseconds: 400)); // splash fades out

    expect(find.text('Learn more'), findsOneWidget);
    expect(find.byType(LegalScreen), findsNothing);

    await tester.tap(find.text('Learn more'));
    await tester.pump(); // route push starts
    await tester
        .pump(const Duration(milliseconds: 500)); // fade-through completes

    // The legal screen lands with the Cookies document selected via the
    // app bar + segmented control.
    expect(find.byType(LegalScreen), findsOneWidget);
    expect(find.text('Legal & Privacy'), findsOneWidget);
    expect(find.text('Cookies'), findsOneWidget);
  });

  testWidgets('cookie notice Got it dismisses the notice',
      (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const ErlbrewApp(forceCookieNotice: true));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('Got it'), findsOneWidget);

    await tester.tap(find.text('Got it'));
    // pumpAndSettle can't be used here: the boot splash's loader animates
    // forever in the test binding (boot never completes without real
    // platform channels), so settle always times out.
    await tester.pump(); // setState removes the notice from the stack
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Learn more'), findsNothing);
    expect(find.byType(LegalScreen), findsNothing);
  });
}
