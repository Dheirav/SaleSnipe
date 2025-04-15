const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const AlertSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  targetPrice: {
    type: Number,
    required: true
  },
  active: {
    type: Boolean,
    default: true
  },
  notificationSent: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false
  },
  watchlist: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  alerts: [AlertSchema],
  preferences: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    desktopNotifications: {
      type: Boolean,
      default: true
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to hash password
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to generate JWT token
UserSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { id: this._id }, 
    process.env.JWT_SECRET || 'your_jwt_secret_should_be_in_env_file',
    { expiresIn: '30d' }
  );
};

// Method to add product to watchlist
UserSchema.methods.addToWatchlist = async function(productId) {
  // Check if product already exists in watchlist
  const exists = this.watchlist.some(item => 
    item.productId.toString() === productId.toString()
  );
  
  if (!exists) {
    this.watchlist.push({ productId });
    await this.save();
  }
  
  return this.watchlist;
};

// Method to remove product from watchlist
UserSchema.methods.removeFromWatchlist = async function(productId) {
  this.watchlist = this.watchlist.filter(
    item => item.productId.toString() !== productId.toString()
  );
  await this.save();
  return this.watchlist;
};

// Method to create price alert
UserSchema.methods.createAlert = async function(productId, targetPrice) {
  this.alerts.push({
    productId,
    targetPrice,
    active: true,
    notificationSent: false
  });
  await this.save();
  return this.alerts;
};

// Method to update alert status
UserSchema.methods.updateAlertStatus = async function(alertId, updates) {
  const alert = this.alerts.id(alertId);
  if (!alert) return null;
  
  Object.keys(updates).forEach(key => {
    alert[key] = updates[key];
  });
  
  await this.save();
  return alert;
};

const User = mongoose.model('User', UserSchema);

module.exports = User; 