import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../models/app_models.dart';
import '../theme/app_theme.dart';
import '../widgets/fade_slide_in.dart';

/// Shown to the customer at checkout so the barista can scan it and
/// award points. Encodes just enough to identify the account —
/// swap the payload for a signed token from your real backend later.
class MyQrScreen extends StatelessWidget {
  const MyQrScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = MockData.currentUser!;
    final payload = jsonEncode({
      'type': 'erlbrew_customer',
      'id': user.id,
      'name': user.name,
    });

    return Scaffold(
      appBar: AppBar(title: const Text('My QR Code')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: FadeSlideIn(
            child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Show this at the counter',
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                'The barista scans this to add your points',
                style: TextStyle(color: AppColors.slateGrey, fontSize: 13),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 1),
                duration: const Duration(milliseconds: 550),
                curve: Curves.easeOutBack,
                builder: (context, t, child) =>
                    Transform.scale(scale: t, child: child),
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [AppColors.softShadow],
                    border: Border.all(color: AppColors.latte),
                  ),
                  child: QrImageView(
                    data: payload,
                    size: 220,
                    backgroundColor: Colors.white,
                    eyeStyle: const QrEyeStyle(
                      eyeShape: QrEyeShape.square,
                      color: AppColors.espresso,
                    ),
                    dataModuleStyle: const QrDataModuleStyle(
                      dataModuleShape: QrDataModuleShape.square,
                      color: AppColors.espresso,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                user.name,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
              ),
              Text(
                user.email,
                style: TextStyle(color: AppColors.slateGrey, fontSize: 12.5),
              ),
            ],
            ),
          ),
        ),
      ),
    );
  }
}
