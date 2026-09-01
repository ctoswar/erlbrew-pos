import 'package:flutter/material.dart';

/// Animates a number counting up (or down) whenever [value] changes,
/// instead of it just snapping — used for the points balance so
/// earning/redeeming points feels alive.
class AnimatedCounter extends StatefulWidget {
  final int value;
  final TextStyle? style;

  const AnimatedCounter({super.key, required this.value, this.style});

  @override
  State<AnimatedCounter> createState() => _AnimatedCounterState();
}

class _AnimatedCounterState extends State<AnimatedCounter> {
  late int _oldValue;

  @override
  void initState() {
    super.initState();
    _oldValue = widget.value;
  }

  @override
  void didUpdateWidget(covariant AnimatedCounter oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value) {
      _oldValue = oldWidget.value;
    }
  }

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: _oldValue.toDouble(), end: widget.value.toDouble()),
      duration: const Duration(milliseconds: 700),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Text('${value.round()}', style: widget.style);
      },
    );
  }
}
