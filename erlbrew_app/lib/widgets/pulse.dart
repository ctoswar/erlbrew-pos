import 'package:flutter/material.dart';

/// Gently scales its child up and down on a loop — used to draw the eye
/// to something that needs attention, like a "Ready for Pickup" badge.
class Pulse extends StatefulWidget {
  final Widget child;
  final bool active;

  const Pulse({super.key, required this.child, this.active = true});

  @override
  State<Pulse> createState() => _PulseState();
}

class _PulseState extends State<Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
    if (widget.active) _controller.repeat(reverse: true);
  }

  @override
  void didUpdateWidget(covariant Pulse oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && !_controller.isAnimating) {
      _controller.repeat(reverse: true);
    } else if (!widget.active) {
      _controller.stop();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.active) return widget.child;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final scale = 1 + _controller.value * 0.06;
        return Transform.scale(scale: scale, child: child);
      },
      child: widget.child,
    );
  }
}
