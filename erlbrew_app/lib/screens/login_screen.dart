import 'package:flutter/material.dart';
import '../models/app_models.dart';
import '../theme/app_theme.dart';
import '../widgets/brand_mark.dart';
import '../widgets/fade_slide_in.dart';
import '../widgets/luxury_button.dart';
import 'admin/admin_home_shell.dart';
import 'home_shell.dart';
import 'signup_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  bool _isAdmin = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);

    // Front-end only: simulate a network call, then sign the user in
    // with mock data. Wire this up to a real auth API later, and check
    // the account's actual role instead of a local toggle.
    await Future.delayed(const Duration(milliseconds: 700));

    if (!mounted) return;
    setState(() => _loading = false);

    if (_isAdmin) {
      MockData.currentUser = MockData.adminUser;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const AdminHomeShell()),
      );
      return;
    }

    MockData.currentUser ??= MockData.customers.firstWhere(
      (c) => c.id == 'cust-1',
    );

    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const HomeShell()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.ivory,
      body: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          child: Column(
            children: [
              FadeSlideIn(child: _HeroPanel(isAdmin: _isAdmin)),
              Transform.translate(
                offset: const Offset(0, -32),
                child: FadeSlideIn(
                  delay: const Duration(milliseconds: 160),
                  child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 22),
                  padding: const EdgeInsets.fromLTRB(26, 28, 26, 26),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(28),
                    border: Border.all(color: AppColors.hairline),
                    boxShadow: [AppColors.softShadow],
                  ),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          _isAdmin ? 'Staff Sign In' : 'Welcome Back',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.displayMedium,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _isAdmin
                              ? 'Manage orders, rewards, and customers'
                              : 'Log in to track your points and pickups',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              color: AppColors.slateGrey, fontSize: 13.5),
                        ),
                        const SizedBox(height: 26),
                        _RoleToggle(
                          isAdmin: _isAdmin,
                          onChanged: (v) => setState(() => _isAdmin = v),
                        ),
                        const SizedBox(height: 28),
                        TextFormField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          decoration: InputDecoration(
                            labelText: _isAdmin ? 'Staff Email' : 'Email',
                            prefixIcon: const Icon(Icons.mail_outline, size: 20),
                          ),
                          validator: (v) {
                            if (v == null || v.trim().isEmpty) {
                              return 'Enter your email';
                            }
                            if (!v.contains('@')) return 'Enter a valid email';
                            return null;
                          },
                        ),
                        const SizedBox(height: 22),
                        TextFormField(
                          controller: _passwordController,
                          obscureText: _obscure,
                          decoration: InputDecoration(
                            labelText: 'Password',
                            prefixIcon: const Icon(Icons.lock_outline, size: 20),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscure
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                                size: 20,
                              ),
                              onPressed: () =>
                                  setState(() => _obscure = !_obscure),
                            ),
                          ),
                          validator: (v) {
                            if (v == null || v.length < 6) {
                              return 'Password must be at least 6 characters';
                            }
                            return null;
                          },
                        ),
                        if (!_isAdmin)
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed: () {},
                              child: Text(
                                'Forgot password?',
                                style: TextStyle(color: AppColors.gold),
                              ),
                            ),
                          ),
                        SizedBox(height: _isAdmin ? 30 : 18),
                        LuxuryButton(
                          label: _isAdmin ? 'Enter Dashboard' : 'Log In',
                          loading: _loading,
                          onPressed: _handleLogin,
                        ),
                        const SizedBox(height: 22),
                        if (!_isAdmin)
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text("Don't have an account?",
                                  style: TextStyle(
                                      color: AppColors.slateGrey,
                                      fontSize: 13.5)),
                              TextButton(
                                onPressed: () {
                                  Navigator.of(context).push(
                                    MaterialPageRoute(
                                        builder: (_) => const SignupScreen()),
                                  );
                                },
                                child: Text('Sign Up',
                                    style: TextStyle(
                                        color: AppColors.gold,
                                        fontWeight: FontWeight.w700)),
                              ),
                            ],
                          ),
                      ],
                    ),
                  ),
                ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The dark hero panel behind the logo — gives the login screen the
/// "boutique storefront" feel instead of a plain white form.
class _HeroPanel extends StatelessWidget {
  final bool isAdmin;
  const _HeroPanel({required this.isAdmin});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.only(top: 44, bottom: 76),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: AppColors.onyxGradient,
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(36),
          bottomRight: Radius.circular(36),
        ),
      ),
      child: Column(
        children: [
          const BrandMark(width: 168),
          const SizedBox(height: 18),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 250),
            child: Text(
              isAdmin ? 'STAFF PORTAL' : 'REWARDS & PICKUP',
              key: ValueKey(isAdmin),
              style: TextStyle(
                color: AppColors.goldLight,
                fontWeight: FontWeight.w600,
                fontSize: 11.5,
                letterSpacing: 3.2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Segmented control the barista/owner uses to switch between the
/// customer login form and the staff/admin one.
class _RoleToggle extends StatelessWidget {
  final bool isAdmin;
  final ValueChanged<bool> onChanged;

  const _RoleToggle({required this.isAdmin, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.ivory,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Row(
        children: [
          Expanded(
            child: _RoleOption(
              label: 'Customer',
              icon: Icons.person_outline,
              selected: !isAdmin,
              onTap: () => onChanged(false),
            ),
          ),
          Expanded(
            child: _RoleOption(
              label: 'Admin',
              icon: Icons.admin_panel_settings_outlined,
              selected: isAdmin,
              onTap: () => onChanged(true),
            ),
          ),
        ],
      ),
    );
  }
}

class _RoleOption extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _RoleOption({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 11),
        decoration: BoxDecoration(
          gradient: selected
              ? const LinearGradient(colors: AppColors.espressoGradient)
              : null,
          borderRadius: BorderRadius.circular(10),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: AppColors.espresso.withOpacity(0.25),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon,
                size: 15,
                color: selected ? AppColors.goldLight : AppColors.slateGrey),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 12.5,
                letterSpacing: 0.3,
                color: selected ? AppColors.goldLight : AppColors.slateGrey,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
