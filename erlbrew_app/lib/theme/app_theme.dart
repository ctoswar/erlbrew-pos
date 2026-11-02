import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Erlbrew Café brand palette — warm, editorial and deliberately restrained.
class AppColors {
  static const Color espresso = Color(0xFF2A1D16);
  static const Color onyx = Color(0xFF17110E);
  static const Color coffeeBrown = Color(0xFF76513B);
  static const Color cream = Color(0xFFFFFFFF);
  static const Color ivory = Color(0xFFF8F5F0);
  static const Color latte = Color(0xFFF1E7D7);
  static const Color hairline = Color(0xFFE8DED2);
  static const Color matcha = Color(0xFF4F806A);
  static const Color matchaDark = Color(0xFF35624F);
  static const Color slateGrey = Color(0xFF82766D);
  static const Color gold = Color(0xFFC17A43);
  static const Color goldLight = Color(0xFFF4D8B8);
  static const Color error = Color(0xFFC65D51);
  static const Color success = Color(0xFF4F806A);
  static const Color mist = Color(0xFFE7EFEA);

  static const List<Color> espressoGradient = [
    Color(0xFF5E3E2C),
    Color(0xFF2A1D16),
  ];

  static const List<Color> onyxGradient = [
    Color(0xFF5E3E2C),
    Color(0xFF2A1D16),
  ];

  static BoxShadow softShadow = BoxShadow(
    color: espresso.withOpacity(0.08),
    blurRadius: 28,
    offset: const Offset(0, 14),
  );

  static BoxShadow goldGlow = BoxShadow(
    color: gold.withOpacity(0.18),
    blurRadius: 30,
    spreadRadius: 2,
  );
}

class AppTheme {
  static ThemeData get light {
    final base = ThemeData.light(useMaterial3: true);

    return base.copyWith(
      scaffoldBackgroundColor: AppColors.ivory,
      visualDensity: VisualDensity.standard,
      colorScheme: base.colorScheme.copyWith(
        primary: AppColors.coffeeBrown,
        secondary: AppColors.gold,
        surface: AppColors.ivory,
        onSurface: AppColors.espresso,
        error: AppColors.error,
      ),
      textTheme: GoogleFonts.manropeTextTheme(base.textTheme).copyWith(
        displayLarge: GoogleFonts.playfairDisplay(
          fontSize: 34,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
          color: AppColors.espresso,
        ),
        displayMedium: GoogleFonts.playfairDisplay(
          fontSize: 29,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.4,
          color: AppColors.espresso,
        ),
        titleLarge: GoogleFonts.playfairDisplay(
          fontSize: 23,
          fontWeight: FontWeight.w600,
          color: AppColors.espresso,
        ),
        titleMedium: GoogleFonts.manrope(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          color: AppColors.espresso,
        ),
        bodyMedium: GoogleFonts.manrope(
          fontSize: 14,
          height: 1.45,
          color: AppColors.espresso,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.ivory,
        foregroundColor: AppColors.espresso,
        elevation: 0,
        centerTitle: false,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        titleSpacing: 20,
        titleTextStyle: GoogleFonts.manrope(
          fontSize: 24,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.2,
          color: AppColors.espresso,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.gold,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: GoogleFonts.manrope(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.2,
          ),
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.espresso,
          side: const BorderSide(color: AppColors.hairline, width: 1.2),
          minimumSize: const Size.fromHeight(54),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: GoogleFonts.manrope(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.2,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.cream,
        isDense: true,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.hairline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.hairline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.gold, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.error, width: 1.2),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.error, width: 1.5),
        ),
        labelStyle: GoogleFonts.manrope(
          color: AppColors.slateGrey,
          fontSize: 13,
        ),
        floatingLabelStyle: GoogleFonts.manrope(
          color: AppColors.gold,
          fontWeight: FontWeight.w600,
          fontSize: 13,
        ),
        prefixIconColor: AppColors.slateGrey,
        suffixIconColor: AppColors.slateGrey,
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: const BorderSide(color: AppColors.hairline),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 78,
        elevation: 0,
        backgroundColor: AppColors.cream,
        surfaceTintColor: Colors.transparent,
        indicatorColor: AppColors.latte,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return GoogleFonts.manrope(
            fontSize: 11,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            letterSpacing: 0.1,
            color: selected ? AppColors.espresso : AppColors.slateGrey,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? AppColors.goldLight : AppColors.slateGrey,
            size: selected ? 22 : 21,
          );
        }),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.onyx,
        contentTextStyle: GoogleFonts.manrope(color: Colors.white),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: const BorderSide(color: AppColors.hairline),
        ),
        titleTextStyle: GoogleFonts.manrope(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: AppColors.espresso,
        ),
        contentTextStyle: GoogleFonts.manrope(
          fontSize: 14,
          color: AppColors.slateGrey,
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.latte,
        labelStyle: GoogleFonts.manrope(
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
        color: AppColors.hairline,
        thickness: 1,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.gold,
        foregroundColor: Colors.white,
        elevation: 2,
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: CupertinoPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.windows: CupertinoPageTransitionsBuilder(),
          TargetPlatform.linux: CupertinoPageTransitionsBuilder(),
        },
      ),
    );
  }
}
