import 'package:cloud_functions/cloud_functions.dart';

import '../models/app_models.dart';

/// Client for Firebase PayMongo callables.
///
/// Prices are sent to the UI for display only. Checkout pricing and all
/// PayMongo credentials remain in Cloud Functions.
class PayMongoService {
  PayMongoService._();

  static final PayMongoService instance = PayMongoService._();

  static final FirebaseFunctions _functions =
      FirebaseFunctions.instanceFor(region: 'asia-southeast1');

  Future<CheckoutSession> createCheckout({
    required List<CartLine> items,
    required PickupPaymentMethod paymentMethod,
  }) async {
    try {
      final result =
          await _functions.httpsCallable('createPayMongoCheckout').call({
        'items': [
          for (final line in items) {'id': line.item.id, 'qty': line.quantity},
        ],
        'payment_method': paymentMethod.name,
      });
      final data = result.data;
      if (data is! Map) {
        throw const PosApiException('The checkout response was invalid.');
      }

      final orderId = data['order_id'];
      final checkoutUrl = data['checkout_url'];
      if (orderId is! String || checkoutUrl is! String) {
        throw const PosApiException('The checkout response was invalid.');
      }

      final uri = Uri.tryParse(checkoutUrl);
      if (uri == null ||
          uri.scheme != 'https' ||
          !_isPayMongoCheckoutHost(uri.host)) {
        throw const PosApiException('The checkout URL was not trusted.');
      }
      return CheckoutSession(
        orderId: orderId,
        checkoutUrl: checkoutUrl,
        total: (data['total'] as num?)?.toDouble() ?? 0,
      );
    } on FirebaseFunctionsException catch (error) {
      throw PosApiException(
        error.message ?? 'Unable to start secure checkout.',
      );
    } on PosApiException {
      rethrow;
    } catch (_) {
      throw const PosApiException('Unable to start secure checkout.');
    }
  }

  Future<PickupStatus> fetchOrderStatus(String orderId) async {
    try {
      final result =
          await _functions.httpsCallable('getPayMongoOrderStatus').call({
        'order_id': orderId,
      });
      final data = result.data;
      final status = data is Map ? data['status'] : null;
      switch (status) {
        case 'preparing':
          return PickupStatus.preparing;
        case 'ready':
          return PickupStatus.ready;
        case 'completed':
          return PickupStatus.completed;
        case 'cancelled':
          return PickupStatus.cancelled;
        default:
          return PickupStatus.pending;
      }
    } on FirebaseFunctionsException catch (error) {
      throw PosApiException(
        error.message ?? 'Unable to refresh payment status.',
      );
    } catch (_) {
      throw const PosApiException('Unable to refresh payment status.');
    }
  }

  static bool _isPayMongoCheckoutHost(String host) {
    return host == 'checkout.paymongo.com' ||
        host == 'checkout-sandbox.paymongo.com';
  }
}

class CartLine {
  final MenuItem item;
  final int quantity;

  const CartLine({required this.item, required this.quantity});
}

class CheckoutSession {
  final String orderId;
  final String checkoutUrl;
  final double total;

  const CheckoutSession({
    required this.orderId,
    required this.checkoutUrl,
    required this.total,
  });
}

class PosApiException implements Exception {
  final String message;

  const PosApiException(this.message);

  @override
  String toString() => message;
}
