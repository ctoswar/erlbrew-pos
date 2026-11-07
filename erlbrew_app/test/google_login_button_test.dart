import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:erlbrew_app/screens/login_screen.dart';

/// Pumps [LoginScreen] directly — pumping the full ErlbrewApp would put the
/// boot splash (an interactive IgnorePointer until Firebase finishes, which
/// never completes under the test binding) over the form and swallow taps.
void main() {
  Future<void> pumpLoginScreen(WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const MaterialApp(home: LoginScreen()));
    await tester.pump();
  }

  testWidgets('Google sign-in is offered on the customer tab',
      (WidgetTester tester) async {
    await pumpLoginScreen(tester);

    expect(find.text('Sign in with Google'), findsOneWidget);
  });

  testWidgets('Google sign-in is relabeled on the staff tab',
      (WidgetTester tester) async {
    await pumpLoginScreen(tester);

    await tester.tap(find.text('Admin'));
    await tester.pump();

    expect(find.text('Continue with Google'), findsOneWidget);
    expect(find.text('Sign in with Google'), findsNothing);
  });
}
