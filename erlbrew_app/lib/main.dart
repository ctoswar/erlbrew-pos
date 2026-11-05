import 'dart:async';

import 'package:flutter/material.dart';

import 'screens/login_screen.dart';
import 'services/firebase_auth_service.dart';
import 'services/pos_api_service.dart';
import 'theme/app_theme.dart';
import 'widgets/branded_loader.dart';
import 'widgets/brand_mark.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  unawaited(PosApiService.instance.init());
  // Paint the app immediately (branded boot splash below) instead of a
  // white frame, then finish Firebase init off the first frame. The old
  // WebKit race is still covered: `ensureFirebaseReady()` runs before any
  // sign-in path can touch Firebase, and every auth entrypoint re-checks
  // via `_ensureReady()` as a safety net.
  runApp(const ErlbrewApp());
}

class ErlbrewApp extends StatefulWidget {
  const ErlbrewApp({super.key});

  @override
  State<ErlbrewApp> createState() => _ErlbrewAppState();
}

class _ErlbrewAppState extends State<ErlbrewApp> {
  bool _booted = false;

  @override
  void initState() {
    super.initState();
    unawaited(_boot());
  }

  Future<void> _boot() async {
    await FirebaseAuthService.instance.ensureFirebaseReady();
    // Whether it succeeded or failed, hand over to the login screen —
    // it displays the actionable error when Firebase could not start.
    if (mounted) setState(() => _booted = true);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Erlbrew Café',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: Stack(
        children: [
          const LoginScreen(),
          // Branded boot splash covering the login form until Firebase is
          // ready (or has failed) — softly fades out when done. Once
          // transparent at opacity 0 nothing paints, so it costs nothing.
          Positioned.fill(
            child: IgnorePointer(
              ignoring: _booted,
              child: AnimatedOpacity(
                opacity: _booted ? 0.0 : 1.0,
                duration: const Duration(milliseconds: 320),
                curve: Curves.easeOut,
                child: const _BootSplash(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BootSplash extends StatelessWidget {
  const _BootSplash({super.key});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.ivory,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          const BrandMark(width: 150),
          const SizedBox(height: 34),
          const ErlbrewLoader(
            size: 58,
            label: 'Warming up the café…',
          ),
        ],
      ),
    );
  }
}
