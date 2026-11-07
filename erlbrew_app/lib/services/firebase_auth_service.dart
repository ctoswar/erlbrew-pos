import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:google_sign_in/google_sign_in.dart';

import '../firebase_options.dart';
import '../models/app_models.dart';

class FirebaseAuthService {
  FirebaseAuthService._();

  /// Web OAuth client ID for Google sign-in on native builds — the app
  /// initializes Firebase Dart-side (no google-services gradle plugin), so
  /// the plugin can't auto-discover it. Set via
  /// `--dart-define=GOOGLE_SERVER_CLIENT_ID=...apps.googleusercontent.com`
  /// (see config/env.example). Unused on web, which uses signInWithPopup.
  static const String _googleServerClientId =
      String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');

  GoogleSignIn _googleSignIn() => _googleServerClientId.isEmpty
      ? GoogleSignIn()
      : GoogleSignIn(serverClientId: _googleServerClientId);

  bool _firebaseInitFailed = false;

  /// Accessing [Firebase.apps] can THROW on iOS Safari / WebKit while the
  /// Firebase JS SDK module is still loading (or when its load failed) — the
  /// js_interop backing for the web plugin is not present yet. Wrap it so the
  /// app never crashes just by *checking* whether Firebase is ready.
  bool _appsEmpty() {
    try {
      return Firebase.apps.isEmpty;
    } catch (error) {
      // iOS Safari / WebKit while the Firebase JS module is not loaded yet.
      return true;
    }
  }

  static FirebaseAuthService get instance {
    // Avoid Firebase.apps here: on WebKit it may throw before the SDK's JS
    // module has loaded (the reason for ensureFirebaseReady() + _appsEmpty()).
    return FirebaseAuthService._();
  }

  FirebaseAuth? _auth;
  FirebaseFirestore? _firestore;

  bool get isReady => _auth != null && _firestore != null;

  /// Whether Firebase could not be initialized (e.g. blocked network /
  /// unsupported browser). The UI can surface this as actionable guidance.
  bool get firebaseInitFailed => _firebaseInitFailed;

  /// Idempotent: initialize Firebase (loading its JS SDK on web) and wire up
  /// FirebaseAuth / FirebaseFirestore. Called from main() before runApp so
  /// no sign-in path races the SDK load, and from every auth entrypoint as a
  /// safety net.
  Future<bool> ensureFirebaseReady() async {
    if (isReady) return true;
    if (_firebaseInitFailed) return false;

    try {
      if (_appsEmpty()) {
        await Firebase.initializeApp(
          options: DefaultFirebaseOptions.currentPlatform,
        );
      }
      _auth ??= FirebaseAuth.instance;
      _firestore ??= FirebaseFirestore.instance;
    } catch (error) {
      _firebaseInitFailed = true;
    }
    return isReady;
  }

  Future<void> _ensureReady() async {
    // One initialization path for everything (used by main() too). Throws a
    // mapped FirebaseAuthException when Firebase genuinely cannot start; the
    // login screens map that code to actionable guidance instead of a raw
    // "null check operator" crash.
    final ok = await ensureFirebaseReady();
    if (!ok) {
      throw FirebaseAuthException(
        code: 'firebase-init-failed',
        message:
            'Firebase could not start in this browser. Try a normal '
            '(non-private) browser tab or check the connection.',
      );
    }
  }

  String? get currentUserId => _auth?.currentUser?.uid;

  Future<String?> getIdToken() async {
    await _ensureReady();
    return _auth!.currentUser?.getIdToken();
  }

  Future<AppUser> signInWithEmailPassword({
    required String email,
    required String password,
    required bool isAdmin,
  }) async {
    await _ensureReady();

    try {
      final credential = await _auth!.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );

      final userDoc =
          await _firestore!.collection('users').doc(credential.user!.uid).get();
      final profile = userDoc.data() ?? <String, dynamic>{};
      final storedRole = (profile['role'] ??
              (profile['isAdmin'] == true ? 'admin' : 'customer'))
          .toString();
      final isAdminAccount =
          profile['isAdmin'] == true || storedRole == 'admin';

      if (isAdmin && !isAdminAccount) {
        await _auth!.signOut();
        throw FirebaseAuthException(
          code: 'not-admin',
          message: 'This account does not have staff access.',
        );
      }

      if (!isAdmin && isAdminAccount) {
        await _auth!.signOut();
        throw FirebaseAuthException(
          code: 'customer-only',
          message: 'Use the staff toggle to sign in as admin.',
        );
      }

      final currentUser = AppUser.fromMap(credential.user!.uid, {
        ...profile,
        'name':
            profile['name'] ?? credential.user!.displayName ?? 'Erlbrew User',
        'email': profile['email'] ?? credential.user!.email ?? email,
        'role': storedRole,
        'isAdmin': isAdminAccount,
      });

      return currentUser;
    } on FirebaseAuthException {
      rethrow;
    }
  }

  /// Google sign-in. Web uses the Firebase popup; native builds use the
  /// google_sign_in plugin. Role checks mirror [signInWithEmailPassword]:
  /// admin mode demands an existing admin profile, customer mode rejects
  /// staff accounts. A brand-new Google user has no Firestore profile and
  /// falls through as a customer — the POS `firebase-login` endpoint then
  /// decides (404 → the login screen asks them to sign up with the same
  /// email first; Google emails always pass its email_verified gate).
  Future<AppUser> signInWithGoogle({required bool isAdmin}) async {
    await _ensureReady();

    final UserCredential credential;
    if (kIsWeb) {
      credential = await _auth!.signInWithPopup(GoogleAuthProvider());
    } else {
      final account = await _googleSignIn().signIn();
      if (account == null) {
        throw FirebaseAuthException(
          code: 'google-signin-cancelled',
          message: 'Google sign-in was cancelled.',
        );
      }
      final googleAuth = await account.authentication;
      credential = await _auth!.signInWithCredential(
        GoogleAuthProvider.credential(
          accessToken: googleAuth.accessToken,
          idToken: googleAuth.idToken,
        ),
      );
    }
    final user = credential.user!;

    final userDoc = await _firestore!.collection('users').doc(user.uid).get();
    final profile = userDoc.data() ?? <String, dynamic>{};
    final storedRole = (profile['role'] ??
            (profile['isAdmin'] == true ? 'admin' : 'customer'))
        .toString();
    final isAdminAccount = profile['isAdmin'] == true || storedRole == 'admin';

    if (isAdmin && !isAdminAccount) {
      await signOut();
      throw FirebaseAuthException(
        code: 'not-admin',
        message: 'This Google account does not have staff access.',
      );
    }

    if (!isAdmin && isAdminAccount) {
      await signOut();
      throw FirebaseAuthException(
        code: 'customer-only',
        message: 'Use the staff toggle to sign in as admin.',
      );
    }

    if (!isAdmin && !userDoc.exists) {
      // First Google sign-in: provision the Firestore profile so the
      // customer shows up in the admin directory and home streams —
      // mirrors what signUp() writes. Phone is unknown for Google
      // accounts; the POS row carries a placeholder instead.
      try {
        await _firestore!.collection('users').doc(user.uid).set({
          'uid': user.uid,
          'name': profile['name'] ?? user.displayName ?? 'Erlbrew User',
          'email': profile['email'] ?? user.email ?? '',
          'phone': '',
          'points': 0,
          'role': 'customer',
          'isAdmin': false,
          'createdAt': FieldValue.serverTimestamp(),
          'updatedAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));
      } catch (_) {
        // Non-fatal — the POS row is what backs the session; a stricter
        // ruleset that rejects this write must not break sign-in.
      }
    }

    return AppUser.fromMap(user.uid, {
      ...profile,
      'name': profile['name'] ?? user.displayName ?? 'Erlbrew User',
      'email': profile['email'] ?? user.email ?? '',
      'role': storedRole,
      'isAdmin': isAdminAccount,
    });
  }

  Future<AppUser> signUp({
    required String name,
    required String email,
    required String phone,
    required String password,
  }) async {
    await _ensureReady();

    final credential = await _auth!.createUserWithEmailAndPassword(
      email: email.trim(),
      password: password.trim(),
    );

    final cleanName = name.trim();
    final cleanPhone = phone.trim();

    await credential.user?.updateDisplayName(cleanName);
    await _firestore!.collection('users').doc(credential.user!.uid).set(
      {
        'uid': credential.user!.uid,
        'name': cleanName,
        'email': email.trim(),
        'phone': cleanPhone,
        'points': 0,
        'role': 'customer',
        'isAdmin': false,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      },
      SetOptions(merge: true),
    );

    return AppUser(
      id: credential.user!.uid,
      name: cleanName,
      email: email.trim(),
      points: 0,
      isAdmin: false,
    );
  }

  Future<void> signOut() async {
    await _ensureReady();
    await _auth!.signOut();
    // Native Google sign-in keeps its own device session — clear it too so
    // the next sign-in shows the account picker again instead of silently
    // re-using the last Google account.
    if (!kIsWeb) {
      try {
        await _googleSignIn().signOut();
      } catch (_) {
        // Google not configured on this build — Firebase sign-out already
        // happened, which is what matters.
      }
    }
  }

  Future<void> sendPasswordResetEmail(String email) async {
    await _ensureReady();
    await _auth!.sendPasswordResetEmail(email: email.trim());
  }

  Future<void> sendEmailVerification() async {
    await _ensureReady();
    final user = _auth!.currentUser;
    if (user == null) {
      throw FirebaseAuthException(
        code: 'not-authenticated',
        message: 'Your account could not be verified yet.',
      );
    }
    if (!user.emailVerified) {
      await user.sendEmailVerification();
    }
  }

  Future<bool> isEmailVerified() async {
    await _ensureReady();
    return _auth!.currentUser?.emailVerified ?? false;
  }

  Future<ConfirmationResult> sendPhoneOtp(String phoneNumber) async {
    await _ensureReady();
    return _auth!.signInWithPhoneNumber(phoneNumber.trim());
  }

  Future<void> updateDisplayName(String name) async {
    await _ensureReady();

    final user = _auth!.currentUser;
    final cleanName = name.trim();
    if (user == null) {
      throw FirebaseAuthException(
        code: 'not-authenticated',
        message: 'You must be signed in to update your name.',
      );
    }

    if (cleanName.isEmpty) {
      throw FirebaseAuthException(
        code: 'invalid-name',
        message: 'Enter a valid name.',
      );
    }

    await user.updateDisplayName(cleanName);
    await _firestore!.collection('users').doc(user.uid).set(
      {
        'name': cleanName,
        'updatedAt': FieldValue.serverTimestamp(),
      },
      SetOptions(merge: true),
    );
  }

  Future<int> awardPoints({
    required String customerId,
    required int points,
  }) async {
    if (points <= 0) {
      throw ArgumentError.value(points, 'points', 'Must be greater than zero.');
    }
    await _ensureReady();

    final customerRef = _firestore!.collection('users').doc(customerId);
    return _firestore!.runTransaction<int>((transaction) async {
      final snapshot = await transaction.get(customerRef);
      if (!snapshot.exists) {
        throw FirebaseException(
          plugin: 'cloud_firestore',
          code: 'customer-not-found',
          message: 'This customer account could not be found.',
        );
      }

      final data = snapshot.data() ?? <String, dynamic>{};
      final currentPoints = (data['points'] as num?)?.toInt() ?? 0;
      final updatedPoints = currentPoints + points;
      final notificationRef = customerRef.collection('notifications').doc();

      transaction.update(customerRef, {'points': updatedPoints});
      transaction.set(notificationRef, {
        'type': 'points_awarded',
        'title': 'Points received',
        'message': 'You received $points points at Erlbrew Café.',
        'points': points,
        'createdAt': FieldValue.serverTimestamp(),
        'read': false,
      });
      return updatedPoints;
    });
  }

  Future<int> adjustCustomerPoints({
    required String customerId,
    required int delta,
  }) async {
    await _ensureReady();
    final customerRef = _firestore!.collection('users').doc(customerId);
    return _firestore!.runTransaction<int>((transaction) async {
      final snapshot = await transaction.get(customerRef);
      if (!snapshot.exists) {
        throw FirebaseException(
          plugin: 'cloud_firestore',
          code: 'customer-not-found',
          message: 'This customer account could not be found.',
        );
      }
      final data = snapshot.data() ?? <String, dynamic>{};
      final current = (data['points'] as num?)?.toInt() ?? 0;
      final updated = (current + delta).clamp(0, 999999);
      transaction.update(customerRef, {'points': updated});
      return updated;
    });
  }

  Future<void> updateOrderStatus({
    required String orderId,
    required String status,
  }) async {
    await _ensureReady();
    await _firestore!.collection('orders').doc(orderId).set(
      {
        'status': status,
        'updated_at': FieldValue.serverTimestamp(),
      },
      SetOptions(merge: true),
    );
  }

  Stream<DocumentSnapshot<Map<String, dynamic>>> customerProfileStream(
    String customerId,
  ) {
    return FirebaseFirestore.instance
        .collection('users')
        .doc(customerId)
        .snapshots();
  }

  Stream<List<AppUser>> adminCustomersStream() {
    return FirebaseFirestore.instance.collection('users').snapshots().map(
          (snapshot) => snapshot.docs
              .map((doc) => AppUser.fromMap(doc.id, doc.data()))
              .where((user) => !user.isAdmin)
              .toList()
            ..sort(
                (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase())),
        );
  }

  Stream<List<PickupOrder>> adminOrdersStream() {
    return FirebaseFirestore.instance
        .collection('orders')
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map(
            (snapshot) => snapshot.docs.map(_pickupOrderFromDocument).toList());
  }

  Stream<List<PickupOrder>> customerOrdersStream(String customerId) {
    return FirebaseFirestore.instance
        .collection('orders')
        .where('userId', isEqualTo: customerId)
        .snapshots()
        .map((snapshot) {
      final orders = snapshot.docs.map(_pickupOrderFromDocument).toList();
      orders.sort((a, b) => b.placedAt.compareTo(a.placedAt));
      return orders;
    });
  }

  PickupOrder _pickupOrderFromDocument(
    QueryDocumentSnapshot<Map<String, dynamic>> document,
  ) {
    final data = document.data();
    final rawCreatedAt = data['createdAt'];
    final placedAt = rawCreatedAt is Timestamp
        ? rawCreatedAt.toDate()
        : DateTime.tryParse(rawCreatedAt?.toString() ?? '') ?? DateTime.now();
    final status = PickupStatus.values.firstWhere(
      (value) => value.name == data['status'],
      orElse: () => PickupStatus.pending,
    );
    final paymentMethod = PickupPaymentMethod.values.firstWhere(
      (value) => value.name == data['paymentMethod'],
      orElse: () => PickupPaymentMethod.gcash,
    );
    final paymentStatus = PickupPaymentStatus.values.firstWhere(
      (value) => value.name == data['paymentStatus'],
      orElse: () => PickupPaymentStatus.pending,
    );
    final rawItems = data['items'];
    final itemSummary = rawItems is List
        ? rawItems.map((item) {
            if (item is Map) {
              return '${item['quantity'] ?? item['qty'] ?? 1}x ${item['name'] ?? 'Item'}';
            }
            return item.toString();
          }).join(', ')
        : 'Order items unavailable';

    return PickupOrder(
      id: (data['id'] ?? document.id).toString(),
      customerName: (data['customerName'] ?? 'Erlbrew Customer').toString(),
      itemSummary: itemSummary,
      placedAt: placedAt,
      paymentMethod: paymentMethod,
      total: (data['total'] as num?)?.toDouble(),
      paymentStatus: paymentStatus,
      status: status,
    );
  }

  Stream<QuerySnapshot<Map<String, dynamic>>> customerNotificationsStream(
    String customerId,
  ) {
    return FirebaseFirestore.instance
        .collection('users')
        .doc(customerId)
        .collection('notifications')
        .orderBy('createdAt', descending: true)
        .limit(1)
        .snapshots();
  }

  Future<AppUser?> getSignedInUserProfile() async {
    await _ensureReady();

    final user = _auth!.currentUser;
    if (user == null) return null;

    final userDoc = await _firestore!.collection('users').doc(user.uid).get();
    if (!userDoc.exists) {
      return AppUser(
        id: user.uid,
        name: user.displayName ?? 'Erlbrew User',
        email: user.email ?? 'user@erlbrew.cafe',
        points: 0,
        isAdmin: false,
      );
    }

    return AppUser.fromMap(user.uid, userDoc.data() ?? {});
  }
}
