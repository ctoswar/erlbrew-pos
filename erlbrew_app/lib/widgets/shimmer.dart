import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Brand-toned shimmer (a warm latte highlight sweeping across the shape)
/// so loading screens mirror the real layout instead of a bare spinner.
/// Wrap any placeholder in [ShimmerBox], or use the ready-made skeletons
/// (SkeletonTileCard, SkeletonStatCard, ...) which already match the
/// cards they stand in for.
class ShimmerBox extends StatefulWidget {
  final Widget child;

  const ShimmerBox({super.key, required this.child});

  @override
  State<ShimmerBox> createState() => _ShimmerBoxState();
}

class _ShimmerBoxState extends State<ShimmerBox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      child: widget.child,
      builder: (context, child) {
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) {
            // Slide the gradient band from fully left of the shape to
            // fully right; at both extremes the highlight sits just
            // off-canvas, so the loop restart is invisible and the band
            // crosses the shape exactly once per cycle.
            final dx = bounds.width * (_controller.value * 2 - 1);
            const shimmerGradient = LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.latte,
                AppColors.latte,
                AppColors.cream,
                AppColors.latte,
                AppColors.latte,
              ],
              stops: [0.28, 0.42, 0.5, 0.58, 0.72],
            );
            return shimmerGradient.createShader(
              bounds.shift(Offset(dx, 0)),
            );
          },
          child: child,
        );
      },
    );
  }
}

/// A single shimmering shape.
class SkeletonBox extends StatelessWidget {
  final double? width;
  final double height;
  final BorderRadius radius;

  const SkeletonBox({
    super.key,
    this.width,
    this.height = 14,
    this.radius = const BorderRadius.all(Radius.circular(7)),
  });

  @override
  Widget build(BuildContext context) {
    return ShimmerBox(
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: AppColors.latte,
          borderRadius: radius,
        ),
      ),
    );
  }
}

/// A short line of "text" — [icons] fraction of the available width.
class SkeletonLine extends StatelessWidget {
  final double widthFactor;
  final double height;
  final Alignment alignment;

  const SkeletonLine({
    super.key,
    this.widthFactor = 1,
    this.height = 13,
    this.alignment = Alignment.centerLeft,
  });

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: alignment,
      child: FractionallySizedBox(
        widthFactor: widthFactor.clamp(0.0, 1.0),
        child: SkeletonBox(height: height, width: double.infinity),
      ),
    );
  }
}

/// Mirror of the list cards used across orders / customers / history:
/// round leading avatar, a bold line, a soft line, and an optional
/// trailing pill.
class SkeletonTileCard extends StatelessWidget {
  final bool trailingPill;
  final EdgeInsetsGeometry padding;

  const SkeletonTileCard({
    super.key,
    this.trailingPill = false,
    this.padding = const EdgeInsets.all(14),
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: padding,
        child: Row(
          children: [
            const SkeletonBox(
              width: 42,
              height: 42,
              radius: BorderRadius.all(Radius.circular(12)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SkeletonLine(widthFactor: 0.55, height: 14),
                  const SizedBox(height: 8),
                  const SkeletonLine(widthFactor: 0.85, height: 11),
                  if (trailingPill) ...[
                    const SizedBox(height: 10),
                    const SkeletonBox(
                      width: 120,
                      height: 30,
                      radius: BorderRadius.all(Radius.circular(10)),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 10),
            const SkeletonBox(
              width: 56,
              height: 24,
              radius: BorderRadius.all(Radius.circular(20)),
            ),
          ],
        ),
      ),
    );
  }
}

/// A vertical stack of tile cards, for list placeholders.
class SkeletonTileList extends StatelessWidget {
  final int count;
  final bool trailingPill;

  const SkeletonTileList({
    super.key,
    this.count = 4,
    this.trailingPill = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < count; i++) ...[
          SkeletonTileCard(trailingPill: trailingPill),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

/// Mirror of the two-up stat cards on the dashboards.
class SkeletonStatCard extends StatelessWidget {
  const SkeletonStatCard({super.key});

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SkeletonBox(
              width: 34,
              height: 34,
              radius: BorderRadius.all(Radius.circular(10)),
            ),
            SizedBox(height: 12),
            SkeletonLine(widthFactor: 0.6, height: 18),
            SizedBox(height: 6),
            SkeletonLine(widthFactor: 0.8, height: 10),
          ],
        ),
      ),
    );
  }
}

/// Mirror of the two-up stat row (pair of [SkeletonStatCard]s).
class SkeletonStatRow extends StatelessWidget {
  const SkeletonStatRow({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(child: SkeletonStatCard()),
        const SizedBox(width: 12),
        Expanded(child: Builder(builder: (context) {
          return const SkeletonStatCard();
        })),
      ],
    );
  }
}

/// Mirror of the admin menu / order-sheet grid cells.
class SkeletonGridCard extends StatelessWidget {
  const SkeletonGridCard({super.key});

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                SkeletonBox(width: 26, height: 26),
                Spacer(),
                SkeletonBox(width: 22, height: 18),
              ],
            ),
            SizedBox(height: 10),
            SkeletonLine(widthFactor: 0.85, height: 13),
            SizedBox(height: 6),
            SkeletonLine(widthFactor: 0.5, height: 10),
            Spacer(),
            SkeletonLine(widthFactor: 0.35, height: 14),
          ],
        ),
      ),
    );
  }
}

/// A stand-alone grid of [SkeletonGridCard]s (own scrolling), matching
/// the admin menu grid while it loads.
class SkeletonGrid extends StatelessWidget {
  final int count;
  final EdgeInsetsGeometry padding;

  const SkeletonGrid({
    super.key,
    this.count = 6,
    this.padding = const EdgeInsets.all(16),
  });

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: padding,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 1.4,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: count,
      itemBuilder: (_, __) => const SkeletonGridCard(),
    );
  }
}

/// Mirror of the profile screen: avatar + name lines + stat rows.
class SkeletonProfile extends StatelessWidget {
  const SkeletonProfile({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: const [
        Align(
          child: SkeletonBox(
            width: 72,
            height: 72,
            radius: BorderRadius.all(Radius.circular(36)),
          ),
        ),
        SizedBox(height: 16),
        Align(
          child: SkeletonLine(
            widthFactor: 0.35,
            height: 18,
            alignment: Alignment.center,
          ),
        ),
        SizedBox(height: 8),
        Align(
          child: SkeletonLine(
            widthFactor: 0.45,
            height: 12,
            alignment: Alignment.center,
          ),
        ),
        SizedBox(height: 28),
        Card(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(child: SkeletonLine(widthFactor: 0.8, height: 14)),
                SkeletonBox(width: 60, height: 20),
              ],
            ),
          ),
        ),
        SizedBox(height: 12),
        Card(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(child: SkeletonLine(widthFactor: 0.55, height: 16)),
                SizedBox(width: 12),
                Expanded(child: SkeletonLine(widthFactor: 0.7, height: 16)),
              ],
            ),
          ),
        ),
        SizedBox(height: 20),
        SkeletonTileList(count: 3),
      ],
    );
  }
}
