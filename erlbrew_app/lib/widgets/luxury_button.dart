import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';

/// A richer primary action button than the default ElevatedButton —
/// dark onyx-to-espresso gradient, a gold top hairline, and
/// letter-spaced caps text. Used for the main call-to-action on
/// login/signup so they feel like a boutique product, not a form.
class LuxuryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData? icon;

  const LuxuryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final disabled = onPressed == null || loading;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: disabled ? null : onPressed,
        child: Container(
          height: 56,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: disabled
                  ? [AppColors.slateGrey, AppColors.slateGrey]
                  : AppColors.onyxGradient,
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: disabled
                  ? Colors.transparent
                  : AppColors.gold.withOpacity(0.6),
              width: 1,
            ),
            boxShadow: disabled
                ? []
                : [
                    BoxShadow(
                      color: AppColors.espresso.withOpacity(0.35),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ],
          ),
          alignment: Alignment.center,
          child: loading
              ? const SizedBox(
                  height: 22,
                  width: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.4,
                    color: AppColors.goldLight,
                  ),
                )
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (icon != null) ...[
                      Icon(icon, color: AppColors.goldLight, size: 18),
                      const SizedBox(width: 10),
                    ],
                    Text(
                      label.toUpperCase(),
                      style: GoogleFonts.quicksand(
                        color: AppColors.goldLight,
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        letterSpacing: 1.6,
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
