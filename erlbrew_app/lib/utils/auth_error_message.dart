import 'package:firebase_auth/firebase_auth.dart';

/// Converts any sign-in/sign-up error into a message that tells the user what
/// actually went wrong.
///
/// Before this helper, every non-[FirebaseAuthException] error collapsed into
/// "Something went wrong while signing in." — which hid real, environment-
/// specific failures. The most common of those is iOS Safari: private-browsing
/// mode and ITP block the storage Firebase needs, and in-app browsers (opening
/// the link from Messenger/Instagram etc.) block the auth flow entirely.
String friendlyAuthError(Object error, {required String fallback}) {
  final detail = error.toString();
  final lowered = detail.toLowerCase();

  if (error is FirebaseAuthException) {
    // Unmapped FirebaseAuth codes still deserve their real message.
    final msg = error.message?.trim() ?? '';
    if (msg.isNotEmpty) return '$fallback (${error.code}): $msg';
    return '$fallback (${error.code}).';
  }

  // iOS Safari / private mode: Firebase needs local storage (IndexedDB) and
  // Safari blocks it in private tabs or when "website data" is disallowed.
  if (lowered.contains('insecure') ||
      lowered.contains('indexeddb') ||
      lowered.contains('storage') && lowered.contains('operation') ||
      lowered.contains('unavailable') && lowered.contains('storage') ||
      lowered.contains('quota')) {
    return 'Your browser blocked sign-in storage. Open this page in a normal '
        '(non-private) Safari tab, allow cookies & website data for this site, '
        'then try again — or use the Erlbrew mobile app.';
  }

  // In-app browsers (opened from Messenger/Instagram/QR scanners) and
  // Safari's popup blocker break Firebase flows.
  if (lowered.contains('popup') ||
      lowered.contains('webview') ||
      lowered.contains('web view') ||
      lowered.contains('redirect') && lowered.contains('blocked')) {
    return 'Sign-in was blocked by this browser. Open the page directly in '
        'Safari (not from a chat/QR app), then try again.';
  }

  // Network-level failures (offline, captive portal, DNS).
  if (lowered.contains('network') ||
      lowered.contains('failed host lookup') ||
      lowered.contains('xmlhttprequest')) {
    return 'Could not reach the sign-in service. Check your internet '
        'connection and try again. ($detail)';
  }

  // Unknown — keep the detail visible so it can be reported verbatim.
  final trimmed =
      detail.length > 160 ? '${detail.substring(0, 160)}…' : detail;
  return '$fallback ($trimmed)';
}
