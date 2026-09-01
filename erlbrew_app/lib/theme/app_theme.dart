import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Erlbrew Café brand palette — warm espresso tones with a matcha accent,
/// matching the café's existing menu board / signage design language
/// (Playfair Display for display type, Quicksand for body/UI text).
class AppColors {
  static const Color espresso = Color(0xFF3C2A21);
  static const Color coffeeBrown = Color(0xFF6F4E37);
  static const Color cream = Color(0xFFFFF8F0);
  static const Color latte = Color(0xFFEFE1D1);
  static const Color matcha = Color(0xFF7C9070);
  static const Color matchaDark = Color(0xFF5A6E4F);
  static const Color slateGrey = Color(0xFF70726E); // Estuko Grey, from wall décor
  static const Color gold = Color(0xFFC9A227);
  static const Color error = Color(0xFFB3413B);
  static const Color success = Color(0xFF5A6E4F);

  static const List<Color> espressoGradient = [
    Color(0xFF4A362A),
    Color(0xFF2E2019),
  ];

  static BoxShadow softShadow = BoxShadow(
    color: espresso.withOpacity(0.08),
    blurRadius: 18,
    offset: const Offset(0, 8),
  );
}

class AppTheme {
  static ThemeData get light {
    final base = ThemeData.light(useMaterial3: true);

    return base.copyWith(
      scaffoldBackgroundColor: AppColors.cream,
      colorScheme: base.colorScheme.copyWith(
        primary: AppColors.coffeeBrown,
        secondary: AppColors.matcha,
        surface: AppColors.cream,
        error: AppColors.error,
      ),
      textTheme: GoogleFonts.quicksandTextTheme(base.textTheme).copyWith(
        displayLarge: GoogleFonts.playfairDisplay(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          color: AppColors.espresso,
        ),
        displayMedium: GoogleFonts.playfairDisplay(
          fontSize: 26,
          fontWeight: FontWeight.w700,
          color: AppColors.espresso,
        ),
        titleLarge: GoogleFonts.playfairDisplay(
          fontSize: 22,
          fontWeight: FontWeight.w600,
          color: AppColors.espresso,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.cream,
        foregroundColor: AppColors.espresso,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: GoogleFonts.playfairDisplay(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: AppColors.espresso,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.coffeeBrown,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: GoogleFonts.quicksand(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.coffeeBrown,
          side: const BorderSide(color: AppColors.coffeeBrown, width: 1.4),
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: GoogleFonts.quicksand(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppColors.latte),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppColors.latte),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.coffeeBrown, width: 1.6),
        ),
        labelStyle: GoogleFonts.quicksand(color: AppColors.slateGrey),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 3,
        shadowColor: AppColors.espresso.withOpacity(0.10),
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(color: AppColors.latte),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 68,
        elevation: 0,
        backgroundColor: Colors.white,
        indicatorColor: AppColors.latte,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return GoogleFonts.quicksand(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? AppColors.espresso : AppColors.slateGrey,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? AppColors.coffeeBrown : AppColors.slateGrey,
          );
        }),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.espresso,
        contentTextStyle: GoogleFonts.quicksand(color: Colors.white),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        titleTextStyle: GoogleFonts.playfairDisplay(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: AppColors.espresso,
        ),
        contentTextStyle: GoogleFonts.quicksand(
          fontSize: 14,
          color: AppColors.slateGrey,
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.latte,
        labelStyle: GoogleFonts.quicksand(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: AppColors.espresso,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide.none,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.latte,
        thickness: 1,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.coffeeBrown,
        foregroundColor: Colors.white,
        elevation: 2,
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: ZoomPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        },
      ),
    );
  }
}
