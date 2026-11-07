import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:shared_preferences/shared_preferences.dart';

import '../models/app_models.dart';
import 'firebase_auth_service.dart';
import 'pos_api_service.dart';

/// "Keep me signed in" session persistence.
///
/// Firebase Auth already keeps its own session in the platform's storage;
/// the remember-me flag decides whether the app honors that stored session
/// at boot (skip the login screen and restore) or clears it instead. The
/// POS API session is re-established on restore with a fresh Firebase ID
/// token — never cached passwords.
class SessionService {
  SessionService._();
  static final SessionService instance = SessionService._();

  static const String _rememberKey = 'erlbrew_keep_signed_in';
  static const String _roleKey = 'erlbrew_remember_role';

  /// Persist the checkbox decision made on the login screen. Checked →
  /// remembered, plus which shell to open on the next boot. Unchecked →
  /// forget everything.
  ///
  /// Only called once sign-in has fully succeeded (Firebase session + POS
  /// session both established), so an interrupted login never leaves a
  /// stale auto-login behind.
  Future<void> persistDecision(bool keepSignedIn, bool isAdmin) async {
    final prefs = await SharedPreferences.getInstance();
    if (keepSignedIn) {
      await prefs.setBool(_rememberKey, true);
      await prefs.setString(_roleKey, isAdmin ? 'admin' : 'customer');
    } else {
      await forget();
    }
  }

  /// Forget the opt-in — also used by the Log out buttons so a manual
  /// logout is not undone on the next launch.
  Future<void> forget() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_rememberKey);
    await prefs.remove(_roleKey);
  }

  /// Whether the checkbox should come pre-ticked on the login screen
  /// (matches the visitor's last successful decision).
  Future<bool> rememberMeDefault() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getBool(_rememberKey) == true;
    } catch (_) {
      return false;
    }
  }

  /// Restore the last session at boot. Returns true when the login screen
  /// should be skipped — the caller then picks the shell via
  /// [PosApiService.isStaffLoggedIn].
  Future<bool> restore() async {
    final prefs = await SharedPreferences.getInstance();
    final keep = prefs.getBool(_rememberKey) == true;
    final roleHint = prefs.getString(_roleKey);
    final firebase = FirebaseAuthService.instance;

    // Make sure the POS client has loaded whatever this platform persists
    // (native secure storage; no-op on web).
    try {
      await PosApiService.instance.init();
    } catch (_) {
      // Non-fatal — the POS re-login below works without it.
    }

    if (!keep) {
      // The visitor didn't opt in — clear any stale session left behind so
      // the login screen is always shown on the next launch.
      try {
        if (firebase.currentUserId != null) await firebase.signOut();
      } catch (_) {
        // Shown sign-in state can't outlive storage here anyway.
      }
      try {
        await PosApiService.instance.logout();
        await PosApiService.instance.adminLogout();
      } catch (_) {
        // Memory-only on web — nothing to clear if this failed.
      }
      return false;
    }

    // Firebase-backed restore: exchange a fresh ID token for a POS session
    // (covers both web — where no POS token is cached — and native relaunches).
    try {
      AppUser? profile;
      try {
        profile = await firebase.getSignedInUserProfile();
      } catch (_) {
        // Firestore reachability hiccup — the remembered role is good enough.
      }
      final isAdmin = profile?.isAdmin ?? roleHint == 'admin';
      if (profile == null && roleHint == null) return false;

      final idToken = await firebase.getIdToken();
      if (idToken != null && idToken.isNotEmpty) {
        if (isAdmin) {
          await PosApiService.instance.firebaseStaffLogin(idToken);
        } else {
          final customer =
              await PosApiService.instance.firebaseCustomerLogin(idToken);
          MockData.currentUser = customer;
        }
        return true;
      }
    } catch (_) {
      // Expired / revoked token, backend unreachable, Firebase down — fall
      // through and let the visitor sign in manually.
      return false;
    }

    // Legacy reminder: non-Firebase customer accounts persist their POS
    // token in secure storage (native only), so restore that too.
    if (!kIsWeb && PosApiService.instance.isLoggedIn) {
      MockData.currentUser = PosApiService.instance.currentCustomer;
      return true;
    }
    return false;
  }
}
