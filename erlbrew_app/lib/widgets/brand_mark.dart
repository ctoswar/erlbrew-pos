import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';

class BrandMark extends StatelessWidget {
  final double size;
  const BrandMark({super.key, this.size = 64});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: AppColors.espresso,
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.gold, width: 2),
          ),
          alignment: Alignment.center,
          child: Text(
            'EB',
            style: GoogleFonts.cinzel(
              color: AppColors.cream,
              fontWeight: FontWeight.w700,
              fontSize: size * 0.32,
              letterSpacing: 1.5,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'ERLBREW',
          style: GoogleFonts.cinzel(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            letterSpacing: 4,
            color: AppColors.espresso,
          ),
        ),
        Text(
          'CAFÉ',
          style: GoogleFonts.cormorantGaramond(
            fontSize: 14,
            fontStyle: FontStyle.italic,
            letterSpacing: 3,
            color: AppColors.slateGrey,
          ),
        ),
      ],
    );
  }
}
