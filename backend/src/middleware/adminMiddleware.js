function parseAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const adminEmails = parseAdminEmails();
  return adminEmails.includes(email.toLowerCase().trim());
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.merchantId || !req.session.merchantEmail) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const email = req.session.merchantEmail.toString().toLowerCase().trim();
  const sessionAdmin = req.session.isAdmin === true;
  const envAdmin = isAdminEmail(email);

  if (!sessionAdmin && !envAdmin) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }

  req.session.isAdmin = true;
  next();
}

module.exports = { requireAdmin, isAdminEmail };
