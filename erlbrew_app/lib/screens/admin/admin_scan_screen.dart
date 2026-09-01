import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../models/app_models.dart';
import '../../theme/app_theme.dart';

class AdminScanScreen extends StatefulWidget {
  const AdminScanScreen({super.key});

  @override
  State<AdminScanScreen> createState() => _AdminScanScreenState();
}

class _AdminScanScreenState extends State<AdminScanScreen> {
  final MobileScannerController _controller = MobileScannerController();
  bool _handling = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
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

  void _openAwardSheet(AppUser customer) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _AwardSheet(customer: customer),
    ).whenComplete(() {
      if (!mounted) return;
      setState(() => _handling = false);
      _controller.start();
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
          ),
          // Dim overlay with a viewfinder cutout
          IgnorePointer(
            child: Container(
              decoration: BoxDecoration(color: Colors.black.withOpacity(0.35)),
              child: Center(
                child: Container(
                  width: 240,
                  height: 240,
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.white, width: 2),
                    borderRadius: BorderRadius.circular(20),
                    color: Colors.transparent,
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

/// Bottom sheet shown once a valid customer QR has been scanned, letting
/// the barista award points and/or a stamp with one tap.
class _AwardSheet extends StatefulWidget {
  final AppUser customer;
  const _AwardSheet({required this.customer});

  @override
  State<_AwardSheet> createState() => _AwardSheetState();
}

class _AwardSheetState extends State<_AwardSheet> {
  int _pointsToAdd = 10;
  bool _addStamp = true;
  bool _applied = false;

  static const _pointOptions = [10, 25, 50, 90];

  void _apply() {
    setState(() {
      widget.customer.points += _pointsToAdd;
      if (_addStamp) {
        widget.customer.stamps =
            (widget.customer.stamps + 1).clamp(0, widget.customer.stampsGoal);
      }
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
                            '${c.points} pts · ${c.stamps}/${c.stampsGoal} stamps',
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
              const SizedBox(height: 16),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Also add a stamp'),
                value: _addStamp,
                activeColor: AppColors.matcha,
                onChanged: (v) => setState(() => _addStamp = v),
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: _apply,
                child: Text('Award $_pointsToAdd pts'
                    '${_addStamp ? ' + 1 stamp' : ''}'),
              ),
            ] else ...[
              Icon(Icons.check_circle, color: AppColors.success, size: 48),
              const SizedBox(height: 12),
              Text('Awarded to ${c.name}',
                  style: Theme.of(context).textTheme.titleLarge,
                  textAlign: TextAlign.center),
              const SizedBox(height: 6),
              Text('New balance: ${c.points} pts · ${c.stamps}/${c.stampsGoal} stamps',
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
