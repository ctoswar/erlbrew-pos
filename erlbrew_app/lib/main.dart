import 'dart:async';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'legal/legal_documents.dart';
import 'screens/admin/admin_home_shell.dart';
import 'screens/home_shell.dart';
import 'screens/legal_screen.dart';
import 'screens/login_screen.dart';
import 'services/firebase_auth_service.dart';
import 'services/pos_api_service.dart';
import 'services/session_service.dart';
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
  bool _cookieNotice = false;
  /// Non-null when "Keep me signed in" restored the last session at boot —
  /// the shell the visitor lands in instead of the login screen.
  Widget? _restoredHome;

  static const String _cookieConsentKey = 'erlbrew_cookie_notice_v1';

  @override
  void initState() {
    super.initState();
    unawaited(_boot());
    unawaited(_checkCookieNotice());
  }

  Future<void> _boot() async {
    await FirebaseAuthService.instance.ensureFirebaseReady();
    // "Keep me signed in": restore the last session behind the boot splash.
    // Any failure (expired token, backend unreachable, Firebase down) just
    // falls back to the normal login screen.
    Widget? restored;
    try {
      final ok = await SessionService.instance.restore();
      if (ok) {
        restored = PosApiService.instance.isStaffLoggedIn
            ? const AdminHomeShell()
            : const HomeShell();
      }
    } catch (_) {
      restored = null;
    }
    // Whether it succeeded or failed, hand over — the login screen
    // displays the actionable error when Firebase could not start.
    if (mounted) {
      setState(() {
        _booted = true;
        _restoredHome = restored;
      });
    }
  }

  /// Web only: show the cookie / local-storage notice on first visit
  /// until the user accepts. Native builds use device secure storage,
  /// not browser cookies, so they skip the banner.
  Future<void> _checkCookieNotice() async {
    if (!kIsWeb) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      if (prefs.getBool(_cookieConsentKey) != true && mounted) {
        setState(() => _cookieNotice = true);
      }
    } catch (_) {
      // Storage unavailable (private mode) — don't nag, just skip.
    }
  }

  Future<void> _acceptCookieNotice() async {
    setState(() => _cookieNotice = false);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_cookieConsentKey, true);
    } catch (_) {
      // Best effort — if persisting fails the notice may reappear.
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Erlbrew Café',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: Stack(
        children: [
          _restoredHome ?? const LoginScreen(),
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
          // First-visit cookie / storage notice (web only) — appears once
          // the boot splash has lifted, until the user accepts it.
          if (_booted && _cookieNotice)
            Positioned(
              left: 16,
              right: 16,
              bottom: 16,
              child: _CookieNotice(
                onAccept: _acceptCookieNotice,
                onLearnMore: () =>
                    LegalScreen.show(context, doc: LegalDoc.cookies),
              ),
            ),
        ],
      ),
    );
  }
}

class _BootSplash extends StatelessWidget {
  const _BootSplash();

  @override
  Widget build(BuildContext context) {
    return const Material(
      color: AppColors.ivory,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          BrandMark(width: 150),
          SizedBox(height: 34),
          ErlbrewLoader(
            size: 58,
            label: 'Warming up the café…',
          ),
        ],
      ),
    );
  }
}

/// First-visit cookie / local-storage notice (web only). Accepting is
/// remembered in SharedPreferences so it only ever shows once per browser.
class _CookieNotice extends StatelessWidget {
  final VoidCallback onAccept;
  final VoidCallback onLearnMore;

  const _CookieNotice({required this.onAccept, required this.onLearnMore});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      elevation: 10,
      shadowColor: AppColors.espresso.withValues(alpha: 0.25),
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.cookie_outlined,
                    size: 20, color: AppColors.coffeeBrown),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'We use cookies and local storage to keep you signed in '
                    'and remember your preferences — never for ads.',
                    style: TextStyle(
                      color: AppColors.slateGrey,
                      fontSize: 12,
                      height: 1.45,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: onLearnMore,
                  child: const Text('Learn more'),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.matcha,
                  ),
                  onPressed: onAccept,
                  child: const Text('Got it'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
