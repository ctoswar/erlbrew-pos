import 'package:flutter_test/flutter_test.dart';

import 'package:erlbrew_app/main.dart';
import 'package:erlbrew_app/screens/login_screen.dart';

void main() {
  testWidgets('App builds and shows the login screen', (WidgetTester tester) async {
    // Build the app and trigger a frame.
    await tester.pumpWidget(const ErlbrewApp());

    // The login screen is the home route and should render.
    expect(find.byType(LoginScreen), findsOneWidget);

    // Sanity-check key login UI is present.
    expect(find.text('Welcome back'), findsOneWidget);
    expect(find.text('Email'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(find.text('Log In'), findsOneWidget);
  });
}