import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../models/app_models.dart';
import '../../theme/app_theme.dart';

class AdminScanScreen extends StatefulWidget {
  final bool isActive;

  const AdminScanScreen({
    super.key,
    required this.isActive,
  });

  @override
  State<AdminScanScreen> createState() => _AdminScanScreenState();
}

class _AdminScanScreenState extends State<AdminScanScreen>
    with SingleTickerProviderStateMixin {
  final MobileScannerController _controller =
      MobileScannerController(
        autoStart: false,
      );
  bool _handling = false;
  bool _cameraErrorNotified = false;
  bool _cameraReadyNotified = false;
  late final AnimationController _scanLineController;

  @override
  void initState() {
    super.initState();
    _scanLineController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat(reverse: true);
    _controller.addListener(_onCameraStateChanged);
    if (widget.isActive) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _startCamera());
    }
  }

  @override
  void didUpdateWidget(covariant AdminScanScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive) {
      _startCamera();
    } else if (!widget.isActive && oldWidget.isActive) {
      _controller.stop();
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_onCameraStateChanged);
    _controller.dispose();
    _scanLineController.dispose();
    super.dispose();
  }

  void _onCameraStateChanged() {
    if (!_controller.value.isInitialized ||
        _cameraReadyNotified ||
        !mounted) {
      return;
    }

    _cameraReadyNotified = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Camera access is allowed on this device. Ready to scan.'),
          duration: Duration(seconds: 3),
        ),
      );
    });
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handling) return;
    final raw = capture.barcodes.isNotEmpty
        ? capture.barcodes.first.rawValue
        : null;
    if (raw == null) return;

    AppUser? customer;
    try {
      final data = jsonDecode(raw) as Map<String, dynamic>;
      if (data['type'] != 'erlbrew_customer') {
        _showError('Not an Erlbrew customer code');
        return;
      }
      final id = data['id'] as String?;
      customer = MockData.customers.firstWhere(
        (c) => c.id == id,
        orElse: () => throw StateError('not found'),
      );
    } catch (_) {
      _showError('Couldn\'t read that QR code');
      return;
    }

    setState(() => _handling = true);
    _controller.stop();
    _openAwardSheet(customer);
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  void _notifyCameraError(MobileScannerException error) {
    if (_cameraErrorNotified || !mounted) return;
    _cameraErrorNotified = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _showError(
        error.errorCode.name == 'permissionDenied'
            ? 'Camera permission is required to scan QR codes. Allow it in Settings, then tap Try again.'
            : error.errorCode.name == 'unsupported'
                ? 'This device does not have a supported camera for QR scanning.'
                : 'Camera unavailable (${error.errorCode.name}). Close other camera apps and try again.',
      );
    });
  }

  Future<void> _retryCamera() async {
    _cameraErrorNotified = false;
    _cameraReadyNotified = false;
    await _controller.stop();
    await _startCamera();
  }

  Future<void> _startCamera() async {
    if (!mounted || !widget.isActive || _controller.value.isRunning) {
      return;
    }
    try {
      await _controller.start();
    } on MobileScannerException catch (error) {
      _notifyCameraError(error);
    }
  }

  void _openAwardSheet(AppUser customer) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _AwardSheet(customer: customer),
    ).whenComplete(() {
      if (!mounted) return;
      setState(() => _handling = false);
      _startCamera();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan Customer'),
        actions: [
          IconButton(
            icon: const Icon(Icons.cameraswitch_outlined),
            onPressed: () => _controller.switchCamera(),
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
            errorBuilder: (context, error) {
              _notifyCameraError(error);
              return _CameraErrorView(
                error: error,
                onRetry: _retryCamera,
              );
            },
          ),
          // Dim overlay with a viewfinder cutout
          IgnorePointer(
            child: Container(
              decoration: BoxDecoration(color: Colors.black.withOpacity(0.35)),
              child: Center(
                child: SizedBox(
                  width: 240,
                  height: 240,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      // Corner brackets
                      const _ScannerCorner(alignment: Alignment.topLeft),
                      const _ScannerCorner(alignment: Alignment.topRight),
                      const _ScannerCorner(alignment: Alignment.bottomLeft),
                      const _ScannerCorner(alignment: Alignment.bottomRight),
                      // Moving scan line
                      AnimatedBuilder(
                        animation: _scanLineController,
                        builder: (context, child) {
                          return Positioned(
                            top: 8 + _scanLineController.value * 224,
                            left: 8,
                            right: 8,
                            child: child!,
                          );
                        },
                        child: Container(
                          height: 2,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                AppColors.gold.withOpacity(0),
                                AppColors.gold,
                                AppColors.gold.withOpacity(0),
                              ],
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.gold.withOpacity(0.6),
                                blurRadius: 6,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 32,
            child: Center(
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.55),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  'Point the camera at the customer\'s QR code',
                  style: TextStyle(color: Colors.white, fontSize: 13),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CameraErrorView extends StatelessWidget {
  final MobileScannerException error;
  final Future<void> Function() onRetry;

  const _CameraErrorView({
    required this.error,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final permissionDenied = error.errorCode.name == 'permissionDenied';
    return Container(
      color: AppColors.onyx,
      alignment: Alignment.center,
      padding: const EdgeInsets.all(28),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 340),
        child: Container(
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
          decoration: BoxDecoration(
            color: AppColors.espresso,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppColors.gold.withOpacity(0.45)),
            boxShadow: [AppColors.goldGlow],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.no_photography_outlined,
                color: AppColors.goldLight,
                size: 48,
              ),
              const SizedBox(height: 16),
              Text(
                permissionDenied ? 'Camera permission needed' : 'Camera unavailable',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: Colors.white,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                permissionDenied
                    ? 'Allow camera access so Erlbrew can scan customer QR codes.'
                    : error.errorCode.name == 'unsupported'
                        ? 'This device does not have a supported camera.'
                        : 'Close other camera apps and tap Try again. Error: ${error.errorCode.name}.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white70,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Try again'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.gold,
                  foregroundColor: AppColors.onyx,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One gold corner bracket of the scanner viewfinder — four of these
/// combine to frame the square instead of a plain box border.
class _ScannerCorner extends StatelessWidget {
  final Alignment alignment;
  const _ScannerCorner({required this.alignment});

  @override
  Widget build(BuildContext context) {
    final isTop = alignment.y < 0;
    final isLeft = alignment.x < 0;
    return Align(
      alignment: alignment,
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          border: Border(
            top: isTop
                ? const BorderSide(color: AppColors.gold, width: 3)
                : BorderSide.none,
            bottom: !isTop
                ? const BorderSide(color: AppColors.gold, width: 3)
                : BorderSide.none,
            left: isLeft
                ? const BorderSide(color: AppColors.gold, width: 3)
                : BorderSide.none,
            right: !isLeft
                ? const BorderSide(color: AppColors.gold, width: 3)
                : BorderSide.none,
          ),
          borderRadius: BorderRadius.only(
            topLeft: isTop && isLeft ? const Radius.circular(16) : Radius.zero,
            topRight:
                isTop && !isLeft ? const Radius.circular(16) : Radius.zero,
            bottomLeft:
                !isTop && isLeft ? const Radius.circular(16) : Radius.zero,
            bottomRight:
                !isTop && !isLeft ? const Radius.circular(16) : Radius.zero,
          ),
        ),
      ),
    );
  }
}

/// Bottom sheet shown once a valid customer QR has been scanned, letting
/// the barista award points with one tap.
class _AwardSheet extends StatefulWidget {
  final AppUser customer;
  const _AwardSheet({required this.customer});

  @override
  State<_AwardSheet> createState() => _AwardSheetState();
}

class _AwardSheetState extends State<_AwardSheet> {
  int _pointsToAdd = 10;
  bool _applied = false;

  static const _pointOptions = [10, 25, 50, 90];

  void _apply() {
    setState(() {
      widget.customer.points += _pointsToAdd;
      _applied = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.customer;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: AppColors.latte,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            if (!_applied) ...[
              Row(
                children: [
                  CircleAvatar(
                    backgroundColor: AppColors.coffeeBrown,
                    child: Text(
                      c.name.isNotEmpty ? c.name[0].toUpperCase() : '?',
                      style: const TextStyle(color: Colors.white),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(c.name,
                            style:
                                const TextStyle(fontWeight: FontWeight.w700)),
                        Text(
                            '${c.points} pts',
                            style: TextStyle(
                                color: AppColors.slateGrey, fontSize: 12.5)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Text('Points to award',
                  style: TextStyle(
                      fontWeight: FontWeight.w600, color: AppColors.espresso)),
              const SizedBox(height: 10),
              Wrap(
                spacing: 10,
                children: _pointOptions
                    .map((v) => ChoiceChip(
                          label: Text('+$v'),
                          selected: _pointsToAdd == v,
                          onSelected: (_) => setState(() => _pointsToAdd = v),
                          selectedColor: AppColors.matcha,
                          labelStyle: TextStyle(
                            color: _pointsToAdd == v
                                ? Colors.white
                                : AppColors.espresso,
                            fontWeight: FontWeight.w700,
                          ),
                        ))
                    .toList(),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: _apply,
                child: Text('Award $_pointsToAdd pts'),
              ),
            ] else ...[
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 1),
                duration: const Duration(milliseconds: 500),
                curve: Curves.elasticOut,
                builder: (context, t, child) =>
                    Transform.scale(scale: t, child: child),
                child: Icon(Icons.check_circle,
                    color: AppColors.success, size: 48),
              ),
              const SizedBox(height: 12),
              Text('Awarded to ${c.name}',
                  style: Theme.of(context).textTheme.titleLarge,
                  textAlign: TextAlign.center),
              const SizedBox(height: 6),
              Text('New balance: ${c.points} pts',
                  style: TextStyle(color: AppColors.slateGrey),
                  textAlign: TextAlign.center),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Done'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
