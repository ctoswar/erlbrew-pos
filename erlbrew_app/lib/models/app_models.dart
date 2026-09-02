class AppUser {
  final String id;
  final String name;
  final String email;
  int points;
  final bool isAdmin;

  AppUser({
    required this.id,
    required this.name,
    required this.email,
    this.points = 0,
    this.isAdmin = false,
  });

  factory AppUser.fromMap(String uid, Map<String, dynamic> data) {
    final rawName = (data['name'] ?? '').toString();
    final rawEmail = (data['email'] ?? '').toString();
    final roleFlag = data['isAdmin'] == true || data['role'] == 'admin';
    return AppUser(
      id: uid,
      name: rawName.isNotEmpty ? rawName : 'Erlbrew User',
      email: rawEmail.isNotEmpty ? rawEmail : 'user@erlbrew.cafe',
      points: (data['points'] is int) ? data['points'] as int : 0,
      isAdmin: roleFlag,
    );
  }
}

class RewardItem {
  String title;
  String description;
  int pointsCost;
  String emoji;

  RewardItem({
    required this.title,
    required this.description,
    required this.pointsCost,
    required this.emoji,
  });
}

/// A single orderable item on the café's actual menu — what customers
/// pick from when placing a pickup order (different from [RewardItem],
/// which is what points get redeemed for).
class MenuItem {
  final String id;
  String name;
  String category;
  double price;
  String emoji;

  MenuItem({
    required this.id,
    required this.name,
    required this.category,
    required this.price,
    required this.emoji,
  });

  factory MenuItem.fromMap(Map<String, dynamic> data) {
    return MenuItem(
      id: (data['id'] ?? '').toString(),
      name: (data['name'] ?? 'Menu item').toString(),
      category: (data['category'] ?? 'Menu').toString(),
      price: (data['price'] as num?)?.toDouble() ?? 0,
      emoji: (data['emoji'] ?? '☕').toString(),
    );
  }
}

enum PickupStatus { pending, preparing, ready, completed, cancelled }

class PickupOrder {
  final String id;
  final String customerName;
  final String itemSummary;
  final DateTime placedAt;
  final PickupPaymentMethod paymentMethod;
  final double? total;
  final String? checkoutUrl;
  PickupPaymentStatus paymentStatus;
  PickupStatus status;

  PickupOrder({
    required this.id,
    required this.customerName,
    required this.itemSummary,
    required this.placedAt,
    this.paymentMethod = PickupPaymentMethod.gcash,
    this.total,
    this.checkoutUrl,
    this.paymentStatus = PickupPaymentStatus.paid,
    this.status = PickupStatus.preparing,
  });
}

enum PickupPaymentMethod { gcash, qrph }

enum PickupPaymentStatus { pending, paid, failed, cancelled }

/// A tiny in-memory "backend" so the UI has something to react to.
/// Replace with real API calls later.
class MockData {
  static AppUser? currentUser;

  static final AppUser adminUser = AppUser(
    id: 'admin-1',
    name: 'Erlbrew Admin',
    email: 'admin@erlbrew.cafe',
    isAdmin: true,
  );

  static final List<RewardItem> catalog = [
    RewardItem(
      title: 'Free Hot Brewed Coffee',
      description: 'Any size, hot brewed coffee on the house',
      pointsCost: 50,
      emoji: '☕',
    ),
    RewardItem(
      title: 'Free Matcha Latte',
      description: 'Signature Erlbrew matcha, hot or iced',
      pointsCost: 90,
      emoji: '🍵',
    ),
    RewardItem(
      title: 'Pastry of the Day',
      description: 'Any single pastry from today\'s case',
      pointsCost: 70,
      emoji: '🥐',
    ),
    RewardItem(
      title: '₱150 Off Any Order',
      description: 'Applies to your next in-app pickup order',
      pointsCost: 150,
      emoji: '🎟️',
    ),
  ];

  /// The actual café menu customers order from when placing a pickup
  /// order. Fully editable by admins (add/edit/delete).
  static final List<MenuItem> menu = [
    MenuItem(
        id: 'm1',
        name: 'Hot Brewed Coffee',
        category: 'Coffee',
        price: 120,
        emoji: '☕'),
    MenuItem(
        id: 'm2',
        name: 'Cappuccino',
        category: 'Coffee',
        price: 150,
        emoji: '☕'),
    MenuItem(
        id: 'm3',
        name: 'Caramel Macchiato',
        category: 'Coffee',
        price: 165,
        emoji: '☕'),
    MenuItem(
        id: 'm4',
        name: 'Iced Matcha Latte',
        category: 'Matcha',
        price: 170,
        emoji: '🍵'),
    MenuItem(
        id: 'm5',
        name: 'Hot Matcha Latte',
        category: 'Matcha',
        price: 160,
        emoji: '🍵'),
    MenuItem(
        id: 'm6',
        name: 'Croissant',
        category: 'Pastries',
        price: 95,
        emoji: '🥐'),
    MenuItem(
        id: 'm7',
        name: 'Blueberry Muffin',
        category: 'Pastries',
        price: 85,
        emoji: '🧁'),
    MenuItem(
        id: 'm8',
        name: 'Pandesal Set',
        category: 'Pastries',
        price: 60,
        emoji: '🍞'),
  ];

  static final List<PickupOrder> orders = [
    PickupOrder(
      id: 'EB-1042',
      customerName: 'Erlbrew Regular',
      itemSummary: '1x Iced Matcha Latte, 1x Croissant',
      placedAt: DateTime.now().subtract(const Duration(minutes: 12)),
      status: PickupStatus.ready,
    ),
    PickupOrder(
      id: 'EB-1041',
      customerName: 'Migs Santos',
      itemSummary: '2x Cappuccino',
      placedAt: DateTime.now().subtract(const Duration(minutes: 25)),
      status: PickupStatus.preparing,
    ),
    PickupOrder(
      id: 'EB-1040',
      customerName: 'Anna Reyes',
      itemSummary: '1x Hot Brewed Coffee, 1x Pandesal Set',
      placedAt: DateTime.now().subtract(const Duration(hours: 1, minutes: 5)),
      status: PickupStatus.completed,
    ),
  ];

  /// Customer directory for the admin panel.
  static final List<AppUser> customers = [
    AppUser(
      id: 'cust-1',
      name: 'Erlbrew Regular',
      email: 'regular@example.com',
      points: 120,
    ),
    AppUser(
      id: 'cust-2',
      name: 'Migs Santos',
      email: 'migs.santos@example.com',
      points: 60,
    ),
    AppUser(
      id: 'cust-3',
      name: 'Anna Reyes',
      email: 'anna.reyes@example.com',
      points: 210,
    ),
  ];
}
