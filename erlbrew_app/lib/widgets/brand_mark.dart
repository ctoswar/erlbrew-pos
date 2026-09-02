import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// The café's actual logo lockup, presented like a small framed plaque
/// with a soft gold glow — used wherever the brand needs to make a
/// strong first impression (login hero, splash, etc).
class BrandMark extends StatelessWidget {
  final double width;
  final bool framed;

  const BrandMark({super.key, this.width = 172, this.framed = true});

  @override
  Widget build(BuildContext context) {
    final logo = Image.asset(
      'assets/images/erlbrew_logo.jpg',
      width: width,
      fit: BoxFit.contain,
    );

    if (!framed) return logo;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.gold.withOpacity(0.55), width: 1.2),
        boxShadow: [AppColors.goldGlow],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: logo,
      ),
    );
  }
}
