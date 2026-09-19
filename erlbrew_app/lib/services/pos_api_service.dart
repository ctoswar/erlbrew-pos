import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/app_models.dart';

/// HTTP client for the POS backend API.
/// Handles authentication, token storage, and all API calls.
class PosApiService {
  PosApiService._();
  static final PosApiService instance = PosApiService._();

  /// Base URL of the POS backend.
  /// Override with --dart-define=POS_API_URL=http://your-ip:3001
  /// For Android emulator use 10.0.2.2, for iOS simulator use localhost,
  /// for physical devices use the machine's IP.
  static const String baseUrl = String.fromEnvironment(
    'POS_API_URL',
    defaultValue: 'http://localhost:3001',
  );

  static const Duration _timeout = Duration(seconds: 15);

  String? _token;
  String? _staffToken;
  AppUser? _currentCustomer;

  /// Current authenticated customer (null if not logged in)
  AppUser? get currentCustomer => _currentCustomer;
  bool get isLoggedIn => _token != null && _currentCustomer != null;
  bool get isStaffLoggedIn => _staffToken != null;

  /// HTTP headers with customer auth token
  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_token != null) 'Authorization': 'Bearer $_token',
  };

  /// HTTP headers with staff/admin auth token
  Map<String, String> get _adminHeaders => {
    'Content-Type': 'application/json',
    if (_staffToken != null) 'Authorization': 'Bearer $_staffToken',
  };

  /// Initialize: load saved tokens and profile from SharedPreferences
  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('pos_token');
    _staffToken = prefs.getString('pos_staff_token');
    final customerJson = prefs.getString('pos_customer');
    if (_token != null && customerJson != null) {
      try {
        final data = jsonDecode(customerJson);
        _currentCustomer = AppUser.fromMap(
          data['id'].toString(),
          data,
        );
      } catch (_) {
        // Invalid saved data, clear it
        await logout();
      }
    }
  }

  /// Save token and customer to SharedPreferences
  Future<void> _saveSession(String token, AppUser customer) async {
    _token = token;
    _currentCustomer = customer;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('pos_token', token);
    await prefs.setString('pos_customer', jsonEncode(_customerToJson(customer)));
  }

  Map<String, dynamic> _customerToJson(AppUser customer) => {
    'id': customer.id,
    'name': customer.name,
    'email': customer.email,
    'points': customer.points,
    'tier': customer.tier,
    'totalOrders': customer.totalOrders,
    'totalSpent': customer.totalSpent,
    'isAdmin': customer.isAdmin,
  };

  /// Clear saved customer session
  Future<void> logout() async {
    _token = null;
    _currentCustomer = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('pos_token');
    await prefs.remove('pos_customer');
  }

  /// Clear saved staff session
  Future<void> adminLogout() async {
    _staffToken = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('pos_staff_token');
  }

  /// Handle API errors
  dynamic _handleResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return jsonDecode(response.body);
    }
    try {
      final body = jsonDecode(response.body);
      throw PosApiServiceException(body['error'] ?? 'Request failed (${response.statusCode})');
    } catch (_) {
      throw PosApiServiceException('Request failed (${response.statusCode})');
    }
  }

  /// Wrap an HTTP future with a timeout
  Future<http.Response> _withTimeout(Future<http.Response> request) async {
    try {
      return await request.timeout(_timeout);
    } on TimeoutException catch (_) {
      throw PosApiServiceException('Connection timed out. Please try again.');
    }
  }

  // ── Auth Endpoints ────────────────────────────────────────────────

  /// Register a new customer account
  Future<AppUser> register({
    required String phone,
    required String name,
    required String email,
    required String password,
  }) async {
    final response = await _withTimeout(http.post(
      Uri.parse('$baseUrl/api/customers/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'phone': phone, 'name': name, 'email': email, 'password': password}),
    ));
    final data = _handleResponse(response);
    final customer = AppUser.fromMap(data['customer']['id'].toString(), data['customer']);
    await _saveSession(data['token'], customer);
    return customer;
  }

  /// Login with phone + password
  Future<AppUser> login({
    required String phone,
    required String password,
  }) async {
    final response = await _withTimeout(http.post(
      Uri.parse('$baseUrl/api/customers/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'phone': phone, 'password': password}),
    ));
    final data = _handleResponse(response);
    final customer = AppUser.fromMap(data['customer']['id'].toString(), data['customer']);
    await _saveSession(data['token'], customer);
    return customer;
  }

  /// Staff/admin login with username + password
  Future<Map<String, dynamic>> staffLogin({
    required String username,
    required String password,
  }) async {
    final response = await _withTimeout(http.post(
      Uri.parse('$baseUrl/api/staff/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'username': username, 'password': password}),
    ));
    final data = _handleResponse(response);
    _staffToken = data['token'] as String?;
    if (_staffToken != null) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('pos_staff_token', _staffToken!);
    }
    return data;
  }

  // ── Profile Endpoints ─────────────────────────────────────────────

  /// Get current customer profile from POS
  Future<AppUser> getProfile() async {
    final response = await _withTimeout(http.get(
      Uri.parse('$baseUrl/api/customers/me'),
      headers: _headers,
    ));
    final data = _handleResponse(response);
    final customer = AppUser.fromMap(data['id'].toString(), data);
    _currentCustomer = customer;
    // Update saved customer data
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('pos_customer', jsonEncode(_customerToJson(customer)));
    return customer;
  }

  /// Update current customer profile
  Future<AppUser> updateProfile({String? name, String? email}) async {
    final response = await _withTimeout(http.put(
      Uri.parse('$baseUrl/api/customers/me'),
      headers: _headers,
      body: jsonEncode({
        if (name != null) 'name': name,
        if (email != null) 'email': email,
      }),
    ));
    final data = _handleResponse(response);
    final customer = AppUser.fromMap(data['id'].toString(), data);
    _currentCustomer = customer;
    return customer;
  }

  // ── Menu Endpoints ────────────────────────────────────────────────

  /// Fetch menu from POS API (source of truth)
  Future<List<MenuItem>> getMenu() async {
    final response = await _withTimeout(http.get(
      Uri.parse('$baseUrl/api/menu'),
      headers: {'Content-Type': 'application/json'},
    ));
    final data = _handleResponse(response);
    return (data as List).map((item) => MenuItem.fromMap(item)).toList();
  }

  /// Fetch menu grouped by categories (optimized for Flutter)
  Future<Map<String, List<MenuItem>>> getMenuByCategory() async {
    final response = await _withTimeout(http.get(
      Uri.parse('$baseUrl/api/menu/sync'),
      headers: {'Content-Type': 'application/json'},
    ));
    final data = _handleResponse(response);
    final categories = <String, List<MenuItem>>{};
    final catData = data['categories'] as Map<String, dynamic>;
    for (final entry in catData.entries) {
      categories[entry.key] = (entry.value as List)
          .map((item) => MenuItem.fromMap(item))
          .toList();
    }
    return categories;
  }

  // ── Admin Menu Endpoints ──────────────────────────────────────────

  /// Create a new menu item (admin only)
  Future<void> createMenuItem({
    required String id,
    required String name,
    required String category,
    required double price,
    String? emoji,
    String? badge,
    String? description,
  }) async {
    final response = await _withTimeout(http.post(
      Uri.parse('$baseUrl/api/menu'),
      headers: _adminHeaders,
      body: jsonEncode({
        'id': id,
        'name': name,
        'category': category,
        'price': price,
        if (emoji != null) 'emoji': emoji,
        if (badge != null) 'badge': badge,
        if (description != null) 'description': description,
      }),
    ));
    _handleResponse(response);
  }

  /// Update an existing menu item (admin only)
  Future<void> updateMenuItem({
    required String id,
    required String name,
    required String category,
    required double price,
    String? emoji,
    String? badge,
    String? description,
  }) async {
    final response = await _withTimeout(http.put(
      Uri.parse('$baseUrl/api/menu/$id'),
      headers: _adminHeaders,
      body: jsonEncode({
        'name': name,
        'category': category,
        'price': price,
        if (emoji != null) 'emoji': emoji,
        if (badge != null) 'badge': badge,
        if (description != null) 'description': description,
      }),
    ));
    _handleResponse(response);
  }

  /// Delete a menu item (admin only)
  Future<void> deleteMenuItem(String id) async {
    final response = await _withTimeout(http.delete(
      Uri.parse('$baseUrl/api/menu/$id'),
      headers: _adminHeaders,
    ));
    _handleResponse(response);
  }

  // ── Loyalty Endpoints ─────────────────────────────────────────────

  /// Get points balance and recent history
  Future<Map<String, dynamic>> getPoints() async {
    final response = await _withTimeout(http.get(
      Uri.parse('$baseUrl/api/customers/me/points'),
      headers: _headers,
    ));
    return _handleResponse(response);
  }

  /// Get paginated points history
  Future<Map<String, dynamic>> getPointsHistory({int limit = 20, int offset = 0}) async {
    final response = await _withTimeout(http.get(
      Uri.parse('$baseUrl/api/customers/me/points/history?limit=$limit&offset=$offset'),
      headers: _headers,
    ));
    return _handleResponse(response);
  }

  /// Get order history
  Future<List<Map<String, dynamic>>> getOrderHistory({int limit = 20, int offset = 0}) async {
    final response = await _withTimeout(http.get(
      Uri.parse('$baseUrl/api/customers/me/orders?limit=$limit&offset=$offset'),
      headers: _headers,
    ));
    final data = _handleResponse(response);
    return List<Map<String, dynamic>>.from(data as List);
  }

  // ── Rewards Catalog Endpoints ────────────────────────────────────

  /// Fetch active rewards catalog (public)
  Future<List<Map<String, dynamic>>> getRewards() async {
    final response = await _withTimeout(http.get(
      Uri.parse('$baseUrl/api/loyalty/rewards'),
      headers: {'Content-Type': 'application/json'},
    ));
    final data = _handleResponse(response);
    return List<Map<String, dynamic>>.from(data as List);
  }

  /// Fetch ALL rewards including inactive (admin)
  Future<List<Map<String, dynamic>>> getAllRewards() async {
    final response = await _withTimeout(http.get(
      Uri.parse('$baseUrl/api/loyalty/rewards/all'),
      headers: _adminHeaders,
    ));
    final data = _handleResponse(response);
    return List<Map<String, dynamic>>.from(data as List);
  }

  /// Create a reward (admin only)
  Future<Map<String, dynamic>> createReward({
    required String title,
    required String description,
    required int pointsCost,
    String emoji = '🎁',
  }) async {
    final response = await _withTimeout(http.post(
      Uri.parse('$baseUrl/api/loyalty/rewards'),
      headers: _adminHeaders,
      body: jsonEncode({
        'title': title,
        'description': description,
        'points_cost': pointsCost,
        'emoji': emoji,
      }),
    ));
    return _handleResponse(response);
  }

  /// Update a reward (admin only)
  Future<void> updateReward({
    required int id,
    String? title,
    String? description,
    int? pointsCost,
    String? emoji,
    bool? isActive,
  }) async {
    final response = await _withTimeout(http.put(
      Uri.parse('$baseUrl/api/loyalty/rewards/$id'),
      headers: _adminHeaders,
      body: jsonEncode({
        if (title != null) 'title': title,
        if (description != null) 'description': description,
        if (pointsCost != null) 'points_cost': pointsCost,
        if (emoji != null) 'emoji': emoji,
        if (isActive != null) 'is_active': isActive,
      }),
    ));
    _handleResponse(response);
  }

  /// Delete (deactivate) a reward (admin only)
  Future<void> deleteReward(int id) async {
    final response = await _withTimeout(http.delete(
      Uri.parse('$baseUrl/api/loyalty/rewards/$id'),
      headers: _adminHeaders,
    ));
    _handleResponse(response);
  }

  /// Redeem a reward with points
  Future<Map<String, dynamic>> redeemReward(int rewardId) async {
    final response = await _withTimeout(http.post(
      Uri.parse('$baseUrl/api/loyalty/redeem'),
      headers: _headers,
      body: jsonEncode({'reward_id': rewardId}),
    ));
    return _handleResponse(response);
  }

  /// Get customer's redemption history
  Future<List<Map<String, dynamic>>> getRedemptions() async {
    final response = await _withTimeout(http.get(
      Uri.parse('$baseUrl/api/loyalty/my-redemptions'),
      headers: _headers,
    ));
    final data = _handleResponse(response);
    return List<Map<String, dynamic>>.from(data as List);
  }

  // ── Admin Customer Endpoints ──────────────────────────────────────

  /// Look up a customer by ID (for QR scan)
  Future<AppUser?> getCustomerById(String id) async {
    final response = await _withTimeout(http.get(
      Uri.parse('$baseUrl/api/customers/$id'),
      headers: _adminHeaders,
    ));
    if (response.statusCode == 404) return null;
    final data = _handleResponse(response);
    return AppUser.fromMap(data['id'].toString(), data);
  }

  /// List/search customers (admin)
  Future<List<AppUser>> getCustomers({String? search, int limit = 100}) async {
    final uri = Uri.parse('$baseUrl/api/customers')
        .replace(queryParameters: {
          if (search != null && search.isNotEmpty) 'search': search,
          'limit': limit.toString(),
        });
    final response = await _withTimeout(http.get(
      uri,
      headers: _adminHeaders,
    ));
    final data = _handleResponse(response);
    return (data as List)
        .map((c) => AppUser.fromMap(c['id'].toString(), c))
        .toList();
  }

  /// Adjust a customer's loyalty points (admin)
  Future<AppUser> adjustCustomerPoints({
    required int customerId,
    required int delta,
    required String reason,
  }) async {
    final response = await _withTimeout(http.post(
      Uri.parse('$baseUrl/api/customers/me/points/adjust'),
      headers: _adminHeaders,
      body: jsonEncode({
        'customer_id': customerId,
        'points': delta,
        'reason': reason,
      }),
    ));
    final data = _handleResponse(response);
    final customerData = data['customer'] as Map<String, dynamic>;
    return AppUser.fromMap(customerData['id'].toString(), customerData);
  }

  // ── Admin Order Endpoints ─────────────────────────────────────────

  /// Get recent orders for admin dashboard
  Future<List<Map<String, dynamic>>> getAdminOrders({int limit = 20}) async {
    final response = await _withTimeout(http.get(
      Uri.parse('$baseUrl/api/orders?limit=$limit'),
      headers: _adminHeaders,
    ));
    final data = _handleResponse(response);
    return List<Map<String, dynamic>>.from(data as List);
  }

  /// Update order status (admin/staff)
  Future<void> updateOrderStatus({
    required String orderId,
    required String status,
  }) async {
    final response = await _withTimeout(http.put(
      Uri.parse('$baseUrl/api/orders/$orderId/status'),
      headers: _adminHeaders,
      body: jsonEncode({'status': status}),
    ));
    _handleResponse(response);
  }
}

/// Exception thrown by POS API calls
class PosApiServiceException implements Exception {
  final String message;
  PosApiServiceException(this.message);
  @override
  String toString() => message;
}
