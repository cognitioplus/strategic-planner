require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const validator = require('validator');

const app = express();

// ==================== SECURITY MIDDLEWARE ====================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "https://cdn.tailwindcss.com", "https://unpkg.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '10kb' }));
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts, please try again later.'
});

// ==================== DATABASE CONNECTION ====================
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/strategic_planner', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Database connected'))
  .catch(err => console.error('❌ Database connection error:', err));

// ==================== MODELS ====================
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email']
  },
  password: { type: String, required: true, minlength: 8, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isVerified: { type: Boolean, default: false },
  verificationToken: String,
  verificationExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  lastLogin: Date,
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Virtual for account lock
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Increment login attempts
userSchema.methods.incLoginAttempts = function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }
  
  return this.updateOne(updates);
};

const User = mongoose.model('User', userSchema);

const organizationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  mandate: { type: String, required: true },
  swot: {
    S: [{ type: String, trim: true }],
    W: [{ type: String, trim: true }],
    O: [{ type: String, trim: true }],
    T: [{ type: String, trim: true }]
  },
  bsc: [{
    objective: { type: String, required: true },
    perspective: { 
      type: String, 
      enum: ['Financial', 'Customer', 'Internal Processes', 'Learning & Growth'],
      required: true 
    },
    kpi: { type: String, required: true },
    target: { type: String, required: true },
    current: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  initiatives: [{
    title: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['Planning', 'In Progress', 'Completed', 'On Hold'],
      default: 'Planning'
    },
    owner: { type: String, required: true },
    due: { type: Date, required: true },
    output: { type: String, required: true },
    resources: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],
  team: [{
    name: { type: String, required: true },
    role: { type: String, required: true },
    email: { type: String },
    status: { type: String, enum: ['online', 'away', 'offline'], default: 'offline' }
  }],
  messages: [{
    sender: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  version: { type: String, default: '1.0.0' },
  lastBackup: Date
}, { timestamps: true });

const Organization = mongoose.model('Organization', organizationSchema);

// ==================== EMAIL SERVICE ====================
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.mailtrap.io',
  port: process.env.EMAIL_PORT || 2525,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendVerificationEmail = async (email, token, name) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  
  const mailOptions = {
    from: `"Strategic Planner" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'Verify Your Email - Strategic Planner',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to Strategic Planner, ${name}!</h2>
        <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #64748b; word-break: break-all;">${verificationUrl}</p>
        <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
          This link will expire in 24 hours. If you didn't create an account, please ignore this email.
        </p>
      </div>
    `
  };
  
  await transporter.sendMail(mailOptions);
};

const sendPasswordResetEmail = async (email, token, name) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  
  const mailOptions = {
    from: `"Strategic Planner" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'Password Reset Request - Strategic Planner',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Password Reset Request</h2>
        <p>Hello ${name},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #64748b; word-break: break-all;">${resetUrl}</p>
        <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
          This link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
        </p>
      </div>
    `
  };
  
  await transporter.sendMail(mailOptions);
};

// ==================== MIDDLEWARE ====================
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user || !user.isVerified) {
      return res.status(401).json({ error: 'Invalid or unverified account' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid authentication token' });
  }
};

// Input validation middleware
const validateInput = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    next();
  };
};

// ==================== ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    if (!/(?=.*[A-Z])/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
    }
    
    if (!/(?=.*[0-9])/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one number' });
    }
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Create verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    
    // Create user
    const user = await User.create({
      name: validator.escape(name),
      email,
      password,
      verificationToken: hashedToken,
      verificationExpires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });
    
    // Send verification email
    await sendVerificationEmail(email, verificationToken, name);
    
    res.status(201).json({
      message: 'Registration successful! Please check your email to verify your account.',
      email: user.email
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Verify email
app.get('/api/auth/verify-email/:token', async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    
    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }
    
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationExpires = undefined;
    await user.save();
    
    res.json({ message: 'Email verified successfully! You can now log in.' });
    
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    if (user.isLocked) {
      return res.status(423).json({ error: 'Account locked due to too many failed login attempts. Please try again later.' });
    }
    
    if (!user.isVerified) {
      return res.status(403).json({ error: 'Please verify your email before logging in' });
    }
    
    const isPasswordCorrect = await user.comparePassword(password);
    
    if (!isPasswordCorrect) {
      await user.incLoginAttempts();
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      user.loginAttempts = 0;
      user.lockUntil = undefined;
    }
    
    user.lastLogin = Date.now();
    await user.save();
    
    // Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Forgot password
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If an account exists for this email, you will receive password reset instructions.' });
    }
    
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();
    
    await sendPasswordResetEmail(email, resetToken, user.name);
    
    res.json({ message: 'If an account exists for this email, you will receive password reset instructions.' });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Reset password
app.post('/api/auth/reset-password/:token', authLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();
    
    res.json({ message: 'Password reset successful! You can now log in with your new password.' });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Get current user
app.get('/api/auth/me', authenticate, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    }
  });
});

// ==================== ORGANIZATION ROUTES ====================

// Get organization data
app.get('/api/organization', authenticate, async (req, res) => {
  try {
    let org = await Organization.findOne({ userId: req.user._id });
    
    if (!org) {
      // Create default organization
      org = await Organization.create({
        userId: req.user._id,
        name: 'My Organization',
        mandate: 'To achieve excellence through strategic planning and innovation.',
        swot: { S: [], W: [], O: [], T: [] },
        bsc: [],
        initiatives: [],
        team: [],
        messages: []
      });
    }
    
    res.json(org);
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ error: 'Failed to fetch organization data' });
  }
});

// Update organization
app.put('/api/organization', authenticate, async (req, res) => {
  try {
    const updates = req.body;
    
    // Sanitize inputs
    if (updates.name) updates.name = validator.escape(updates.name);
    if (updates.mandate) updates.mandate = validator.escape(updates.mandate);
    
    const org = await Organization.findOneAndUpdate(
      { userId: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    res.json(org);
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// Add SWOT item
app.post('/api/organization/swot/:type', authenticate, async (req, res) => {
  try {
    const { type } = req.params;
    const { text } = req.body;
    
    if (!['S', 'W', 'O', 'T'].includes(type)) {
      return res.status(400).json({ error: 'Invalid SWOT type' });
    }
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const sanitizedText = validator.escape(text.trim());
    
    const org = await Organization.findOneAndUpdate(
      { userId: req.user._id },
      { $push: { [`swot.${type}`]: sanitizedText } },
      { new: true }
    );
    
    res.json(org);
  } catch (error) {
    console.error('Add SWOT error:', error);
    res.status(500).json({ error: 'Failed to add SWOT item' });
  }
});

// Delete SWOT item
app.delete('/api/organization/swot/:type/:index', authenticate, async (req, res) => {
  try {
    const { type, index } = req.params;
    
    const org = await Organization.findOne({ userId: req.user._id });
    org.swot[type].splice(parseInt(index), 1);
    await org.save();
    
    res.json(org);
  } catch (error) {
    console.error('Delete SWOT error:', error);
    res.status(500).json({ error: 'Failed to delete SWOT item' });
  }
});

// Add BSC strategy
app.post('/api/organization/bsc', authenticate, async (req, res) => {
  try {
    const { objective, perspective, kpi, target, current } = req.body;
    
    if (!objective || !perspective || !kpi || !target || !current) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    const strategy = {
      objective: validator.escape(objective),
      perspective,
      kpi: validator.escape(kpi),
      target: validator.escape(target),
      current: validator.escape(current)
    };
    
    const org = await Organization.findOneAndUpdate(
      { userId: req.user._id },
      { $push: { bsc: strategy } },
      { new: true }
    );
    
    res.json(org);
  } catch (error) {
    console.error('Add BSC error:', error);
    res.status(500).json({ error: 'Failed to add strategy' });
  }
});

// Update BSC strategy
app.put('/api/organization/bsc/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (updates.objective) updates.objective = validator.escape(updates.objective);
    if (updates.kpi) updates.kpi = validator.escape(updates.kpi);
    if (updates.target) updates.target = validator.escape(updates.target);
    if (updates.current) updates.current = validator.escape(updates.current);
    
    const org = await Organization.findOneAndUpdate(
      { userId: req.user._id, 'bsc._id': id },
      { $set: { 'bsc.$': { ...updates, _id: id } } },
      { new: true }
    );
    
    res.json(org);
  } catch (error) {
    console.error('Update BSC error:', error);
    res.status(500).json({ error: 'Failed to update strategy' });
  }
});

// Delete BSC strategy
app.delete('/api/organization/bsc/:id', authenticate, async (req, res) => {
  try {
    const org = await Organization.findOneAndUpdate(
      { userId: req.user._id },
      { $pull: { bsc: { _id: req.params.id } } },
      { new: true }
    );
    
    res.json(org);
  } catch (error) {
    console.error('Delete BSC error:', error);
    res.status(500).json({ error: 'Failed to delete strategy' });
  }
});

// Add initiative
app.post('/api/organization/initiatives', authenticate, async (req, res) => {
  try {
    const { title, status, owner, due, output, resources } = req.body;
    
    const initiative = {
      title: validator.escape(title),
      status,
      owner: validator.escape(owner),
      due: new Date(due),
      output: validator.escape(output),
      resources: resources ? validator.escape(resources) : ''
    };
    
    const org = await Organization.findOneAndUpdate(
      { userId: req.user._id },
      { $push: { initiatives: initiative } },
      { new: true }
    );
    
    res.json(org);
  } catch (error) {
    console.error('Add initiative error:', error);
    res.status(500).json({ error: 'Failed to add initiative' });
  }
});

// Delete initiative
app.delete('/api/organization/initiatives/:id', authenticate, async (req, res) => {
  try {
    const org = await Organization.findOneAndUpdate(
      { userId: req.user._id },
      { $pull: { initiatives: { _id: req.params.id } } },
      { new: true }
    );
    
    res.json(org);
  } catch (error) {
    console.error('Delete initiative error:', error);
    res.status(500).json({ error: 'Failed to delete initiative' });
  }
});

// Add team member
app.post('/api/organization/team', authenticate, async (req, res) => {
  try {
    const { name, role, email, status } = req.body;
    
    const member = {
      name: validator.escape(name),
      role: validator.escape(role),
      email: email ? validator.normalizeEmail(email) : '',
      status: status || 'offline'
    };
    
    const org = await Organization.findOneAndUpdate(
      { userId: req.user._id },
      { $push: { team: member } },
      { new: true }
    );
    
    res.json(org);
  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

// Add message
app.post('/api/organization/messages', authenticate, async (req, res) => {
  try {
    const { text } = req.body;
    
    const message = {
      sender: req.user.name,
      text: validator.escape(text),
      timestamp: new Date()
    };
    
    const org = await Organization.findOneAndUpdate(
      { userId: req.user._id },
      { $push: { messages: message } },
      { new: true }
    );
    
    res.json(org);
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Export data
app.get('/api/organization/export', authenticate, async (req, res) => {
  try {
    const org = await Organization.findOne({ userId: req.user._id });
    
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const exportData = {
      exportDate: new Date(),
      user: {
        name: req.user.name,
        email: req.user.email
      },
      organization: org
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="strategic-plan-${Date.now()}.json"`);
    res.json(exportData);
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// ==================== ERROR HANDLING ====================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'An error occurred' 
      : err.message
  });
});

// ==================== SERVER START ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Email service configured`);
  console.log(`🔒 Security middleware enabled`);
});

module.exports = app;
