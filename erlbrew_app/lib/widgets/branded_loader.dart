import 'dart:math' as math;

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Erlbrew's own loading mark — a rotating gold arc around a gently
/// pulsing coffee medallion, with an optional caption. Replaces the
/// default white-clock CircularProgressIndicator so even "waiting"
/// moments feel part of the app.
class ErlbrewLoader extends StatefulWidget {
  final String? label;
  final double size;

  const ErlbrewLoader({super.key, this.label, this.size = 72});

  @override
  State<ErlbrewLoader> createState() => _ErlbrewLoaderState();
}

class _ErlbrewLoaderState extends State<ErlbrewLoader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final diameter = widget.size;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            // The gold arc is the native (always-spinning) indicator; the
            // medallion breathes on a sine so the mark feels alive.
            final breathe =
                1.0 + 0.05 * math.sin(_controller.value * 2 * math.pi);
            return SizedBox(
              width: diameter,
              height: diameter,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  const CircularProgressIndicator(
                    strokeWidth: 2.4,
                    color: AppColors.gold,
                    backgroundColor: AppColors.latte,
                  ),
                  Padding(
                    padding: EdgeInsets.all(diameter * 0.185),
                    child: Transform.scale(
                      scale: breathe,
                      child: Container(
                        decoration: const BoxDecoration(
                          color: AppColors.coffeeBrown,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.coffee_rounded,
                          size: diameter * 0.34,
                          color: AppColors.goldLight,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
        if (widget.label != null) ...[
          const SizedBox(height: 14),
          Text(
            widget.label!,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.slateGrey,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
            ),
          ),
        ],
      ],
    );
  }
}
