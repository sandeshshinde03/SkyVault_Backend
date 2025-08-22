// src/middlewares/authMiddleware.js
import { supabase } from '../config/supabaseClient.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1]; // Bearer <token>
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    // Attach user info to request (will include id, email, etc.)
    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};
