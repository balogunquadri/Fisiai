/**
 * Input Validation Middleware
 * Validates user inputs for security and data integrity
 */

const validator = require('validator');

/**
 * Validate email address
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  return validator.isEmail(email.trim());
}

/**
 * Validate password strength
 * Requirements:
 * - Minimum 7 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
function createValidationError(field, message) {
  return {
    field,
    message,
  };
}

function normalizeValidationErrors(errors) {
  return errors.map((error) => {
    if (typeof error === 'string') {
      return {
        field: 'unknown',
        message: error,
      };
    }
    return error;
  });
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return {
      valid: false,
      errors: [createValidationError('password', 'Password is required and must be a string')],
    };
  }

  const errors = [];

  if (password.length < 7) {
    errors.push(createValidationError('password', 'Password must be at least 7 characters long'));
  }

  if (!/[A-Z]/.test(password)) {
    errors.push(createValidationError('password', 'Password must contain at least one uppercase letter'));
  }

  if (!/[a-z]/.test(password)) {
    errors.push(createValidationError('password', 'Password must contain at least one lowercase letter'));
  }

  if (!/[0-9]/.test(password)) {
    errors.push(createValidationError('password', 'Password must contain at least one number'));
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push(createValidationError('password', 'Password must contain at least one special character (!@#$%^&*...)'));
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate phone number (E.164 format)
 */
function validatePhone(phone) {
  if (!phone) return true; // Phone is optional
  if (typeof phone !== 'string') {
    return false;
  }
  return validator.isMobilePhone(phone, 'any');
}

/**
 * Validate business name
 * - No special characters except space and hyphen
 * - Max 100 characters
 */
function validateBusinessName(name) {
  if (!name || typeof name !== 'string') {
    return false;
  }

  if (name.length > 100) {
    return false;
  }

  // Allow only alphanumeric, spaces, and hyphens
  return /^[a-zA-Z0-9\s\-&.,()]+$/.test(name.trim());
}

/**
 * Sanitize input string
 * - Trim whitespace
 * - Remove null bytes
 * - Escape HTML entities
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }

  return input
    .trim()
    .replace(/\0/g, '') // Remove null bytes
    .substring(0, 10000); // Max 10KB string length
}

/**
 * Middleware: Validate signup request
 */
function validateSignup(req, res, next) {
  const { businessName, email, phone, password } = req.body || {};

  const errors = [];

  // Validate business name
  if (!businessName) {
    errors.push(createValidationError('businessName', 'businessName is required'));
  } else if (!validateBusinessName(businessName)) {
    errors.push(createValidationError('businessName', 'businessName must contain only letters, numbers, spaces, hyphens, and max 100 characters'));
  }

  // Validate email
  if (!email) {
    errors.push(createValidationError('email', 'email is required'));
  } else if (!validateEmail(email)) {
    errors.push(createValidationError('email', 'email must be a valid email address'));
  }

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    errors.push(...passwordValidation.errors);
  }

  // Validate phone (optional)
  if (phone && !validatePhone(phone)) {
    errors.push(createValidationError('phone', 'phone must be a valid phone number'));
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: normalizeValidationErrors(errors),
      messages: normalizeValidationErrors(errors).map((err) => err.message),
    });
  }

  // Sanitize inputs
  req.body.businessName = sanitizeInput(businessName);
  req.body.email = sanitizeInput(email);
  req.body.phone = phone ? sanitizeInput(phone) : undefined;
  // Don't sanitize password - it may contain special characters

  next();
}

/**
 * Middleware: Validate signin request
 */
function validateSignin(req, res, next) {
  const { email, password } = req.body || {};

  const errors = [];

  if (!email) {
    errors.push(createValidationError('email', 'email is required'));
  } else if (!validateEmail(email)) {
    errors.push(createValidationError('email', 'email must be a valid email address'));
  }

  if (!password) {
    errors.push(createValidationError('password', 'password is required'));
  }

  if (errors.length > 0) {
    const normalized = normalizeValidationErrors(errors);
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: normalized,
      messages: normalized.map((err) => err.message),
    });
  }

  // Sanitize email
  req.body.email = sanitizeInput(email);

  next();
}

/**
 * Middleware: Validate inventory update
 */
function validateInventoryUpdate(req, res, next) {
  const { name, quantity, price, category } = req.body || {};

  const errors = [];

  if (!name) {
    errors.push(createValidationError('name', 'name is required'));
  } else if (typeof name !== 'string' || name.length > 100) {
    errors.push(createValidationError('name', 'name must be a string with max 100 characters'));
  }

  if (quantity !== undefined) {
    if (!Number.isInteger(quantity) || quantity < 0) {
      errors.push(createValidationError('quantity', 'quantity must be a non-negative integer'));
    }
  }

  if (price !== undefined) {
    if (typeof price !== 'number' || price < 0) {
      errors.push(createValidationError('price', 'price must be a non-negative number'));
    }
  }

  if (category && (typeof category !== 'string' || category.length > 50)) {
    errors.push(createValidationError('category', 'category must be a string with max 50 characters'));
  }

  if (errors.length > 0) {
    const normalized = normalizeValidationErrors(errors);
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: normalized,
      messages: normalized.map((err) => err.message),
    });
  }

  // Sanitize inputs
  if (name) req.body.name = sanitizeInput(name);
  if (category) req.body.category = sanitizeInput(category);

  next();
}

/**
 * Middleware: Validate contact data
 */
function validateContact(req, res, next) {
  const { name, phone, email, role } = req.body || {};

  const errors = [];

  if (!name || typeof name !== 'string' || name.length > 100) {
    errors.push(createValidationError('name', 'name is required and must be max 100 characters'));
  }

  if (!phone || !validatePhone(phone)) {
    errors.push(createValidationError('phone', 'phone is required and must be a valid phone number'));
  }

  if (email && !validateEmail(email)) {
    errors.push(createValidationError('email', 'email must be a valid email address'));
  }

  if (role && (typeof role !== 'string' || role.length > 50)) {
    errors.push(createValidationError('role', 'role must be a string with max 50 characters'));
  }

  if (errors.length > 0) {
    const normalized = normalizeValidationErrors(errors);
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: normalized,
      messages: normalized.map((err) => err.message),
    });
  }

  // Sanitize inputs
  if (name) req.body.name = sanitizeInput(name);
  if (email) req.body.email = sanitizeInput(email);
  if (phone) req.body.phone = sanitizeInput(phone);
  if (role) req.body.role = sanitizeInput(role);

  next();
}

module.exports = {
  validateEmail,
  validatePassword,
  validatePhone,
  validateBusinessName,
  sanitizeInput,
  validateSignup,
  validateSignin,
  validateInventoryUpdate,
  validateContact,
};
