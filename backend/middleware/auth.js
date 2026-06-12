import jwt from 'jsonwebtoken';

export const protect = async (req, res, next) => {
  try {
    let token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, token missing' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');

    // Attach user information to request object
    req.user = {
      id: decoded.id,
      name: decoded.name,
      email: decoded.email
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error.message);
    return res.status(401).json({ message: 'Not authorized, token invalid or expired' });
  }
};
