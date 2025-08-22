//controllers/authController.js
import { supabase } from '../config/supabaseClient.js';
// =============================
// Signup
// =============================
export const signup = async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.FRONTEND_URL}/login`
      }
    });

    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json({
      message: 'Signup successful! Check your email for confirmation.',
      user: data.user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =============================
// Login
// =============================
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      message: 'Login successful',
      session: data.session,
      user: data.user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =============================
// Logout
// =============================
export const logout = async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'Logout successful' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =============================
// Forgot Password
// =============================
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`
    });

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'Password reset email sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =============================
// Reset Password
// =============================
export const resetPassword = async (req, res) => {
  const { newPassword } = req.body;

  if (!newPassword) return res.status(400).json({ error: 'New password required' });

  try {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'Password reset successfully', user: data.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
