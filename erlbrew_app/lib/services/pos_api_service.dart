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
  /// For Android emulator use 10.0.2.2, for iOS simulator use localhost,
  /// for physical devices use the machine's IP.
  static const String baseUrl = 'http://localhost:3001';

  String? _token;
  AppUser? _currentCustomer;

  /// Current authenticated customer (null if not logged in)
  AppUser? get currentCustomer => _currentCustomer;
  bool get isLoggedIn => _token != null && _currentCustomer != null;

  /// HTTP headers with auth token
  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_token != null) 'Authorization': 'Bearer $_token',
  };

  /// Initialize: load saved token and profile from SharedPreferences
  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('pos_token');
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
    await prefs.setString('pos_customer', jsonEncode({
      'id': customer.id,
      'name': customer.name,
      'email': customer.email,
      'points': customer.points,
      'isAdmin': customer.isAdmin,
    }));
  }

  /// Clear saved session
  Future<void> logout() async {
    _token = null;
    _currentCustomer = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('pos_token');
    await prefs.remove('pos_customer');
  }

  /// Handle API errors
  dynamic _handleResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return jsonDecode(response.body);
    }
    final body = jsonDecode(response.body);
    throw PosApiServiceException(body['error'] ?? 'Request failed (${response.statusCode})');
  }

  // ── Auth Endpoints ────────────────────────────────────────────────

  /// Register a new customer account
  Future<AppUser> register({
    required String phone,
    required String name,
    required String email,
    required String password,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/customers/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'phone': phone, 'name': name, 'email': email, 'password': password}),
    );
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
    final response = await http.post(
      Uri.parse('$baseUrl/api/customers/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'phone': phone, 'password': password}),
    );
    final data = _handleResponse(response);
    final customer = AppUser.fromMap(data['customer']['id'].toString(), data['customer']);
    await _saveSession(data['token'], customer);
    return customer;
  }

  // ── Profile Endpoints ─────────────────────────────────────────────

  /// Get current customer profile from POS
  Future<AppUser> getProfile() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/customers/me'),
      headers: _headers,
    );
    final data = _handleResponse(response);
    final customer = AppUser.fromMap(data['id'].toString(), data);
    _currentCustomer = customer;
    // Update saved customer data
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('pos_customer', jsonEncode({
      'id': customer.id,
      'name': customer.name,
      'email': customer.email,
      'points': customer.points,
      'isAdmin': customer.isAdmin,
    }));
    return customer;
  }

  /// Update current customer profile
  Future<AppUser> updateProfile({String? name, String? email}) async {
    final response = await http.put(
      Uri.parse('$baseUrl/api/customers/me'),
      headers: _headers,
      body: jsonEncode({
        if (name != null) 'name': name,
        if (email != null) 'email': email,
      }),
    );
    final data = _handleResponse(response);
    final customer = AppUser.fromMap(data['id'].toString(), data);
    _currentCustomer = customer;
    return customer;
  }

  // ── Menu Endpoints ────────────────────────────────────────────────

  /// Fetch menu from POS API (source of truth)
  Future<List<MenuItem>> getMenu() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/menu'),
      headers: {'Content-Type': 'application/json'},
    );
    final data = _handleResponse(response);
    return (data as List).map((item) => MenuItem.fromMap(item)).toList();
  }

  /// Fetch menu grouped by categories (optimized for Flutter)
  Future<Map<String, List<MenuItem>>> getMenuByCategory() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/menu/sync'),
      headers: {'Content-Type': 'application/json'},
    );
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
    final response = await http.post(
      Uri.parse('$baseUrl/api/menu'),
      headers: _headers,
      body: jsonEncode({
        'id': id,
        'name': name,
        'category': category,
        'price': price,
        if (emoji != null) 'emoji': emoji,
        if (badge != null) 'badge': badge,
        if (description != null) 'description': description,
      }),
    );
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
    final response = await http.put(
      Uri.parse('$baseUrl/api/menu/$id'),
      headers: _headers,
      body: jsonEncode({
        'name': name,
        'category': category,
        'price': price,
        if (emoji != null) 'emoji': emoji,
        if (badge != null) 'badge': badge,
        if (description != null) 'description': description,
      }),
    );
    _handleResponse(response);
  }

  /// Delete a menu item (admin only)
  Future<void> deleteMenuItem(String id) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/api/menu/$id'),
      headers: _headers,
    );
    _handleResponse(response);
  }

  // ── Loyalty Endpoints ─────────────────────────────────────────────

  /// Get points balance and recent history
  Future<Map<String, dynamic>> getPoints() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/customers/me/points'),
      headers: _headers,
    );
    return _handleResponse(response);
  }

  /// Get paginated points history
  Future<Map<String, dynamic>> getPointsHistory({int limit = 20, int offset = 0}) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/customers/me/points/history?limit=$limit&offset=$offset'),
      headers: _headers,
    );
    return _handleResponse(response);
  }

  /// Get order history
  Future<List<Map<String, dynamic>>> getOrderHistory({int limit = 20, int offset = 0}) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/customers/me/orders?limit=$limit&offset=$offset'),
      headers: _headers,
    );
    final data = _handleResponse(response);
    return (data as List).cast<Map<String, dynamic>>();
  }
}

/// Exception thrown by POS API calls
class PosApiServiceException implements Exception {
  final String message;
  PosApiServiceException(this.message);
  @override
  String toString() => message;
}
