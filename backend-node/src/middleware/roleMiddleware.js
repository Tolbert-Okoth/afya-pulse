// Use after verifyToken, which attaches req.user.role from the database.
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    console.warn(`Access denied: role "${req.user && req.user.role}" tried ${req.method} ${req.originalUrl}`);
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

// Doctors and admins can review and resolve cases
const requireDoctor = requireRole('doctor', 'admin');

module.exports = { requireRole, requireDoctor };
