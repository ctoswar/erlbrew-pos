import 'package:flutter/material.dart';

/// An [IndexedStack] that builds its children lazily: a tab is only
/// mounted the first time it becomes visible, then stays alive so state
/// and scroll position survive. Avoids the "all tabs fire at once"
/// stampede on startup (six admin screens used to request data on every
/// login) and adds a soft fade-through on tab switches.
///
///
/// Pass `isActive: index == current` to screens with cameras or other
/// live resources — they only get constructed when first visited, and
/// their [didUpdateWidget] keeps the resource in check afterwards.
class LazyIndexedStack extends StatefulWidget {
  final int index;
  final List<Widget> children;
  final Duration duration;

  const LazyIndexedStack({
    super.key,
    required this.index,
    required this.children,
    this.duration = const Duration(milliseconds: 260),
  });

  @override
  State<LazyIndexedStack> createState() => _LazyIndexedStackState();
}

class _LazyIndexedStackState extends State<LazyIndexedStack>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
    value: 1.0, // first frame: already fully visible, no fade on app start
  );

  late final Animation<double> _fade = CurvedAnimation(
    parent: _controller,
    curve: Curves.easeOutCubic,
  );

  /// Highest index ever visited — everything up to here is built & alive.
  int _maxVisited = 0;

  @override
  void initState() {
    super.initState();
    _maxVisited = widget.index;
  }

  @override
  void didUpdateWidget(covariant LazyIndexedStack oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.index != widget.index) {
      if (widget.index > _maxVisited) _maxVisited = widget.index;
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fade,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.012),
          end: Offset.zero,
        ).animate(_fade),
        child: IndexedStack(
          index: widget.index,
          children: [
            // Not-yet-visited tabs stay out of the widget tree entirely
            // (a zero-cost box); visited ones are kept mounted forever.
            for (var i = 0; i < widget.children.length; i++)
              i <= _maxVisited ? widget.children[i] : const SizedBox.shrink(),
          ],
        ),
      ),
    );
  }
}
