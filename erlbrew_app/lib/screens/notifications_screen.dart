import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../services/firebase_auth_service.dart';
import '../theme/app_theme.dart';

/// ── Notification history ────────────────────────────────────────────
/// Reads the Firestore inbox the server writes to when a POS order is
/// placed / marked ready for this customer (users/{uid}/notifications).
/// Read state lives on the doc itself, so a tap on a row marks it read.
class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          _MarkAllReadAction(),
        ],
      ),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: FirebaseAuthService.instance.customerNotificationsStream(),
        builder: (BuildContext context,
            AsyncSnapshot<QuerySnapshot<Map<String, dynamic>>> snapshot) {
          if (snapshot.hasError) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'Could not load your notifications right now.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.slateGrey),
                ),
              ),
            );
          }
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: CircularProgressIndicator(color: AppColors.gold),
            );
          }

          final docs = snapshot.data?.docs ?? const [];
          if (docs.isEmpty) {
            return const _EmptyInbox();
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            itemCount: docs.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (BuildContext context, int index) {
              final doc = docs[index];
              final data = doc.data();
              return _NotificationTile(
                docId: doc.id,
                type: (data['type'] ?? '').toString(),
                title: (data['title'] ?? 'Notification').toString(),
                message: (data['message'] ?? '').toString(),
                createdAt: data['createdAt'],
                unread: data['read'] != true,
              );
            },
          );
        },
      ),
    );
  }
}

class _MarkAllReadAction extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseAuthService.instance.customerNotificationsStream(),
      builder: (BuildContext context,
          AsyncSnapshot<QuerySnapshot<Map<String, dynamic>>> snapshot) {
        final docs = snapshot.data?.docs ?? const [];
        final unread = docs.where((d) => d.data()['read'] != true).length;
        if (unread == 0) return const SizedBox.shrink();
        return TextButton(
          onPressed: () {
            FirebaseAuthService.instance.markAllNotificationsRead();
          },
          child: const Text('Mark all read'),
        );
      },
    );
  }
}

class _EmptyInbox extends StatelessWidget {
  const _EmptyInbox();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.notifications_none_rounded,
              size: 64, color: AppColors.gold.withValues(alpha: 0.55)),
          const SizedBox(height: 12),
          const Text('No notifications yet',
              style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 40),
            child: Text(
              "Place an order and we'll let you know when it's in — "
              'and when it is ready for pickup.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.slateGrey, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

IconData _iconForType(String type) {
  switch (type) {
    case 'order_ready':
      return Icons.local_cafe_rounded;
    case 'order_placed':
      return Icons.receipt_long_rounded;
    case 'points_awarded':
      return Icons.stars_rounded;
    default:
      return Icons.notifications_rounded;
  }
}

Color _iconColorForType(String type) {
  switch (type) {
    case 'order_ready':
      return AppColors.success;
    default:
      return AppColors.gold;
  }
}

class _NotificationTile extends StatelessWidget {
  final String docId;
  final String type;
  final String title;
  final String message;
  final Object? createdAt;
  final bool unread;

  const _NotificationTile({
    required this.docId,
    required this.type,
    required this.title,
    required this.message,
    required this.createdAt,
    required this.unread,
  });

  String _relativeTime() {
    if (createdAt is! Timestamp) return '';
    final created = (createdAt as Timestamp).toDate();
    final diff = DateTime.now().difference(created);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${created.day}/${created.month}/${created.year}';
  }

  @override
  Widget build(BuildContext context) {
    final color = _iconColorForType(type);
    return Material(
      color: unread ? AppColors.latte : AppColors.cream,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: unread
            ? () {
                FirebaseAuthService.instance.markNotificationRead(docId);
              }
            : null,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: unread
                  ? AppColors.gold.withValues(alpha: 0.35)
                  : AppColors.hairline,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: color.withValues(alpha: 0.14),
                ),
                child: Icon(_iconForType(type), size: 20, color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontWeight:
                                  unread ? FontWeight.w700 : FontWeight.w600,
                              color: AppColors.espresso,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _relativeTime(),
                          style: const TextStyle(
                              fontSize: 11, color: AppColors.slateGrey),
                        ),
                      ],
                    ),
                    if (message.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        message,
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.slateGrey,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (unread) ...[
                const SizedBox(width: 10),
                Container(
                  width: 9,
                  height: 9,
                  margin: const EdgeInsets.only(top: 4),
                  decoration: const BoxDecoration(
                      shape: BoxShape.circle, color: AppColors.gold),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// ── In-app banner ───────────────────────────────────────────────────
/// The slide-down card HomeShell shows when a fresh notification arrives
/// while the customer is in the app. Tap → open the inbox; the shell
/// decides when the banner goes away.
class NotificationBanner extends StatelessWidget {
  final String title;
  final String message;
  final VoidCallback onTap;

  const NotificationBanner({
    super.key,
    required this.title,
    required this.message,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    // 0 → 1 entrance: slides down from behind the status bar + fades in.
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: 1),
      duration: const Duration(milliseconds: 360),
      curve: Curves.easeOutCubic,
      builder: (BuildContext context, double t, Widget? child) {
        return Opacity(
          opacity: t.clamp(0, 1),
          child: FractionalTranslation(
            translation: Offset(0, 1.4 - 1.4 * t),
            child: child,
          ),
        );
      },
      child: Material(
        color: Colors.transparent,
        child: Container(
          margin: const EdgeInsets.fromLTRB(14, 8, 14, 0),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.onyx,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.gold.withValues(alpha: 0.4)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.25),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(18),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.gold.withValues(alpha: 0.18),
                  ),
                  child: const Icon(Icons.local_cafe_rounded,
                      size: 22, color: AppColors.goldLight),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.goldLight,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        message,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                TextButton(
                  style: TextButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                  ),
                  onPressed: onTap,
                  child: const Text('View',
                      style: TextStyle(color: AppColors.goldLight)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
