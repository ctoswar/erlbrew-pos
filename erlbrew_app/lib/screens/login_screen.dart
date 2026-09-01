import 'package:flutter/material.dart';
import '../models/app_models.dart';
import '../theme/app_theme.dart';
import '../widgets/brand_mark.dart';
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
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 24),
                  const BrandMark(),
                  const SizedBox(height: 32),
                  Text(
                    _isAdmin ? 'Staff sign in' : 'Welcome back',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.displayMedium,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _isAdmin
                        ? 'Manage orders, rewards, and customers'
                        : 'Log in to track your points and pickups',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.slateGrey, fontSize: 14),
                  ),
                  const SizedBox(height: 24),
                  _RoleToggle(
                    isAdmin: _isAdmin,
                    onChanged: (v) => setState(() => _isAdmin = v),
                  ),
                  const SizedBox(height: 24),
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                      labelText: _isAdmin ? 'Staff email' : 'Email',
                      prefixIcon: const Icon(Icons.mail_outline),
                    ),
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) {
                        return 'Enter your email';
                      }
                      if (!v.contains('@')) return 'Enter a valid email';
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _obscure,
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(_obscure
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined),
                        onPressed: () => setState(() => _obscure = !_obscure),
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
                        child: const Text('Forgot password?'),
                      ),
                    ),
                  SizedBox(height: _isAdmin ? 24 : 12),
                  ElevatedButton(
                    onPressed: _loading ? null : _handleLogin,
                    style: _isAdmin
                        ? ElevatedButton.styleFrom(
                            backgroundColor: AppColors.espresso,
                            foregroundColor: Colors.white,
                            minimumSize: const Size.fromHeight(52),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          )
                        : null,
                    child: _loading
                        ? const SizedBox(
                            height: 22,
                            width: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.4,
                              color: Colors.white,
                            ),
                          )
                        : Text(_isAdmin ? 'Log In as Admin' : 'Log In'),
                  ),
                  const SizedBox(height: 20),
                  if (!_isAdmin)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text("Don't have an account?"),
                        TextButton(
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                  builder: (_) => const SignupScreen()),
                            );
                          },
                          child: const Text('Sign Up'),
                        ),
                      ],
                    ),
                ],
              ),
            ),
          ),
        ),
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
        color: AppColors.latte,
        borderRadius: BorderRadius.circular(14),
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
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: selected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          boxShadow: selected ? [AppColors.softShadow] : null,
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon,
                size: 16,
                color: selected ? AppColors.espresso : AppColors.slateGrey),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 13,
                color: selected ? AppColors.espresso : AppColors.slateGrey,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
