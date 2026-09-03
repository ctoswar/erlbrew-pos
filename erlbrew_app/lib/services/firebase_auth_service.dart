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
    return FirebaseFirestore.instance.collection('users').doc(customerId).snapshots();
  }

  Stream<List<AppUser>> adminCustomersStream() {
    return FirebaseFirestore.instance.collection('users').snapshots().map(
      (snapshot) => snapshot.docs
          .map((doc) => AppUser.fromMap(doc.id, doc.data()))
          .where((user) => !user.isAdmin)
          .toList()
        ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase())),
    );
  }

  Stream<List<PickupOrder>> adminOrdersStream() {
    return FirebaseFirestore.instance
        .collection('orders')
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) => snapshot.docs.map(_pickupOrderFromDocument).toList());
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
