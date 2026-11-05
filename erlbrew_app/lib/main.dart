import 'dart:async';
import 'package:flutter/material.dart';

import 'screens/login_screen.dart';
import 'services/firebase_auth_service.dart';
import 'services/pos_api_service.dart';
import 'theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  unawaited(PosApiService.instance.init());
  // Initialize Firebase BEFORE the first frame. Firebase flutterfire web
  // plugins load their JS SDK dynamically; accessing Firebase.apps before
  // the module finishes loading throws "Null check operator used on a null
  // value" on iOS Safari / WebKit (Chromium tolerates it because its module
  // loader resolves on access). Ensuring it here removes that race from all
  // later sign-in paths, and surfaces a failure as a flag the login screen
  // can display instead of swallowing it.
  await FirebaseAuthService.instance.ensureFirebaseReady();
  runApp(const ErlbrewApp());
}

class ErlbrewApp extends StatelessWidget {
  const ErlbrewApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Erlbrew Café',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: const LoginScreen(),
    );
  }
}
