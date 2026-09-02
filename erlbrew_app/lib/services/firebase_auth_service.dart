import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';

import '../firebase_options.dart';
import '../models/app_models.dart';

class FirebaseAuthService {
  FirebaseAuthService._();

  static FirebaseAuthService get instance {
    if (Firebase.apps.isEmpty) {
      return FirebaseAuthService._uninitialized();
    }
    return FirebaseAuthService._();
  }

  FirebaseAuthService._uninitialized()
      : _auth = null,
        _firestore = null;

  FirebaseAuth? _auth;
  FirebaseFirestore? _firestore;

  bool get isReady => _auth != null && _firestore != null;

  Future<void> _ensureReady() async {
    if (isReady) return;

    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
    }

    _auth ??= FirebaseAuth.instance;
    _firestore ??= FirebaseFirestore.instance;
  }

  String? get currentUserId => _auth?.currentUser?.uid;

  Future<void> setUserRole({
    required String uid,
    required String role,
    String? name,
    String? email,
  }) async {
    await _ensureReady();
    final normalizedRole = role == 'admin' ? 'admin' : 'customer';
    final normalizedName = name?.trim().isNotEmpty == true ? name!.trim() : null;
    final normalizedEmail = email?.trim().isNotEmpty == true ? email!.trim() : null;

    await _firestore!.collection('users').doc(uid).set(
      {
        'uid': uid,
        'role': normalizedRole,
        'isAdmin': normalizedRole == 'admin',
        if (normalizedName != null) 'name': normalizedName,
        if (normalizedEmail != null) 'email': normalizedEmail,
        'updatedAt': FieldValue.serverTimestamp(),
      },
      SetOptions(merge: true),
    );
  }

  Future<AppUser> createAdminAccount({
    required String name,
    required String email,
    required String password,
  }) async {
    await _ensureReady();

    final credential = await _auth!.createUserWithEmailAndPassword(
      email: email.trim(),
      password: password.trim(),
    );

    final cleanName = name.trim();
    await credential.user?.updateDisplayName(cleanName);
    await setUserRole(
      uid: credential.user!.uid,
      role: 'admin',
      name: cleanName,
      email: email.trim(),
    );

    return AppUser(
      id: credential.user!.uid,
      name: cleanName,
      email: email.trim(),
      isAdmin: true,
    );
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
        password: password.trim(),
      );

      final userDoc = await _firestore!.collection('users').doc(credential.user!.uid).get();
      final profile = userDoc.data() ?? <String, dynamic>{};
      final storedRole = (profile['role'] ?? (profile['isAdmin'] == true ? 'admin' : 'customer')).toString();
      final isAdminAccount = profile['isAdmin'] == true || storedRole == 'admin';

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
        'name': profile['name'] ?? credential.user!.displayName ?? 'Erlbrew User',
        'email': profile['email'] ?? credential.user!.email ?? email,
        'role': storedRole,
        'isAdmin': isAdminAccount,
      });

      await _firestore!.collection('users').doc(credential.user!.uid).set(
        {
          'email': credential.user!.email ?? email,
          'name': currentUser.name,
          'lastLoginAt': FieldValue.serverTimestamp(),
          'role': storedRole,
          'isAdmin': isAdminAccount,
        },
        SetOptions(merge: true),
      );

      return currentUser;
    } on FirebaseAuthException {
      rethrow;
    }
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
