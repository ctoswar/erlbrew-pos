import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';

/// A richer primary action button than the default ElevatedButton —
/// dark onyx-to-espresso gradient, a gold hairline border, letter-spaced
/// caps text, and a tactile press-down scale so it feels responsive,
/// not flat. Used for the main call-to-action on login/signup/rewards.
class LuxuryButton extends StatefulWidget {
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
  State<LuxuryButton> createState() => _LuxuryButtonState();
}

class _LuxuryButtonState extends State<LuxuryButton> {
  bool _pressed = false;

  bool get _disabled => widget.onPressed == null || widget.loading;

  void _setPressed(bool v) {
    if (_disabled) return;
    setState(() => _pressed = v);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _setPressed(true),
      onTapUp: (_) => _setPressed(false),
      onTapCancel: () => _setPressed(false),
      onTap: _disabled ? null : widget.onPressed,
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          height: 56,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: _disabled
                  ? [AppColors.slateGrey, AppColors.slateGrey]
                  : AppColors.onyxGradient,
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: _disabled
                  ? Colors.transparent
                  : AppColors.gold.withOpacity(_pressed ? 0.85 : 0.6),
              width: 1,
            ),
            boxShadow: _disabled || _pressed
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
          child: widget.loading
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
                    if (widget.icon != null) ...[
                      Icon(widget.icon, color: AppColors.goldLight, size: 18),
                      const SizedBox(width: 10),
                    ],
                    Text(
                      widget.label,
                      style: GoogleFonts.quicksand(
                        color: AppColors.goldLight,
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
