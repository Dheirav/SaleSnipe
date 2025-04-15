const User = require('../models/User');
const Product = require('../models/Product');

// @desc    Create a new price alert
// @route   POST /api/alerts
// @access  Private
exports.createAlert = async (req, res) => {
  try {
    const { productId, targetPrice } = req.body;
    
    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Get user
    const user = await User.findById(req.user.id);
    
    // Create alert
    await user.createAlert(productId, targetPrice);
    
    res.status(201).json({
      success: true,
      message: 'Price alert created successfully',
      alerts: user.alerts
    });
  } catch (error) {
    console.error('Error creating price alert:', error);
    res.status(500).json({ 
      message: 'Server error creating price alert',
      error: error.message 
    });
  }
};

// @desc    Get all alerts for user
// @route   GET /api/alerts
// @access  Private
exports.getAlerts = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate({
        path: 'alerts.productId',
        select: 'title currentPrice url source'
      });
    
    res.json({
      success: true,
      alerts: user.alerts
    });
  } catch (error) {
    console.error('Error getting price alerts:', error);
    res.status(500).json({ 
      message: 'Server error getting price alerts',
      error: error.message 
    });
  }
};

// @desc    Update alert
// @route   PUT /api/alerts/:id
// @access  Private
exports.updateAlert = async (req, res) => {
  try {
    const alertId = req.params.id;
    const { targetPrice, active } = req.body;
    
    // Validate alert data
    if (targetPrice !== undefined && typeof targetPrice !== 'number') {
      return res.status(400).json({ message: 'Target price must be a number' });
    }
    
    if (active !== undefined && typeof active !== 'boolean') {
      return res.status(400).json({ message: 'Active flag must be a boolean' });
    }
    
    // Get user
    const user = await User.findById(req.user.id);
    
    // Find alert
    const alert = user.alerts.id(alertId);
    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }
    
    // Update alert
    const updates = {};
    if (targetPrice !== undefined) updates.targetPrice = targetPrice;
    if (active !== undefined) updates.active = active;
    
    const updatedAlert = await user.updateAlertStatus(alertId, updates);
    
    res.json({
      success: true,
      message: 'Alert updated successfully',
      alert: updatedAlert
    });
  } catch (error) {
    console.error('Error updating price alert:', error);
    res.status(500).json({ 
      message: 'Server error updating price alert',
      error: error.message 
    });
  }
};

// @desc    Delete alert
// @route   DELETE /api/alerts/:id
// @access  Private
exports.deleteAlert = async (req, res) => {
  try {
    const alertId = req.params.id;
    
    // Get user
    const user = await User.findById(req.user.id);
    
    // Find alert
    const alert = user.alerts.id(alertId);
    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }
    
    // Remove alert
    alert.remove();
    await user.save();
    
    res.json({
      success: true,
      message: 'Alert deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting price alert:', error);
    res.status(500).json({ 
      message: 'Server error deleting price alert',
      error: error.message 
    });
  }
}; 