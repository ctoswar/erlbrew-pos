import 'package:flutter/material.dart';

/// Fade-through page route: the incoming screen fades in while drifting
/// up a few pixels and unscaling from 97% — calm and premium, a nice
/// contrast to the default horizontal slide. Use it for the big jumps
/// (login → app shell, logout, deep screens you "open" rather than
/// "walk sideways into").
class FadeThroughRoute<T> extends PageRouteBuilder<T> {
  FadeThroughRoute({
    required Widget page,
    super.settings,
  }) : super(
          transitionDuration: const Duration(milliseconds: 340),
          reverseTransitionDuration: const Duration(milliseconds: 240),
          pageBuilder: (_, __, ___) => page,
          transitionsBuilder: (_, animation, __, child) {
            final curved = CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutCubic,
              reverseCurve: Curves.easeInCubic,
            );
            return FadeTransition(
              opacity: curved,
              child: ScaleTransition(
                scale: Tween(begin: 0.965, end: 1.0).animate(curved),
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0, 0.025),
                    end: Offset.zero,
                  ).animate(curved),
                  child: child,
                ),
              ),
            );
          },
        );
}

/// Convenience for `Navigator.pushReplacement(Navigator(...))`-style calls.
Route<T> fadeThrough<T>(Widget page) => FadeThroughRoute<T>(page: page);
