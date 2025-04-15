const nodemailer = require('nodemailer');
const User = require('../models/User');
const Product = require('../models/Product');

// Configure nodemailer transporter
const createTransporter = () => {
  // For development, use a local test account
  if (process.env.NODE_ENV === 'development') {
    console.log('Using development email configuration');
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'localhost',
      port: process.env.EMAIL_PORT || 1025,
      secure: false,
      ignoreTLS: true
    });
  }
  
  // For production, use configured SMTP server
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

/**
 * Send email notification for price alert
 * @param {Object} user - User document
 * @param {Object} product - Product document
 * @param {Object} alert - Alert object
 * @returns {Promise} - Email sending result
 */
exports.sendPriceAlertEmail = async (user, product, alert) => {
  try {
    if (!user.preferences.emailNotifications) {
      console.log(`Email notifications disabled for user ${user._id}`);
      return { success: false, message: 'Email notifications disabled by user' };
    }
    
    const transporter = createTransporter();
    
    const emailContent = {
      from: process.env.EMAIL_FROM || 'alerts@salesnipe.local',
      to: user.email,
      subject: `Price Alert: ${product.title} is now ${product.currency} ${product.currentPrice}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4a5568;">Price Drop Alert</h2>
          <p>Hello ${user.name},</p>
          <p>Good news! The price for <strong>${product.title}</strong> has dropped below your target price.</p>
          
          <div style="background-color: #f7fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Product:</strong> ${product.title}</p>
            <p><strong>Current Price:</strong> ${product.currency} ${product.currentPrice}</p>
            <p><strong>Your Target Price:</strong> ${product.currency} ${alert.targetPrice}</p>
            <p><strong>Savings:</strong> ${product.currency} ${(alert.targetPrice - product.currentPrice).toFixed(2)}</p>
          </div>
          
          <p><a href="${product.url}" style="background-color: #4299e1; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; display: inline-block;">View Product</a></p>
          
          <p>Happy shopping!</p>
          <p>The SaleSnipe Team</p>
          
          <hr style="border: 1px solid #edf2f7; margin: 20px 0;" />
          <p style="color: #718096; font-size: 12px;">
            You're receiving this email because you set up a price alert in SaleSnipe.
            To manage your notification preferences, visit your account settings.
          </p>
        </div>
      `
    };
    
    const result = await transporter.sendMail(emailContent);
    console.log(`Email sent to ${user.email} for product ${product._id}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending price alert email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check price alerts for all users and send notifications
 * @returns {Promise} - Results of all alert checks
 */
exports.checkPriceAlerts = async () => {
  try {
    console.log('Checking price alerts for all users...');
    const users = await User.find({ 'alerts.active': true })
      .populate({
        path: 'alerts.productId',
        model: 'Product'
      });
    
    console.log(`Found ${users.length} users with active alerts`);
    
    const results = [];
    
    for (const user of users) {
      console.log(`Checking ${user.alerts.length} alerts for user ${user._id}`);
      
      for (const alert of user.alerts) {
        // Skip inactive alerts or already notified
        if (!alert.active || alert.notificationSent) {
          continue;
        }
        
        const product = alert.productId;
        
        // Check if product exists and price has dropped below target
        if (product && product.currentPrice <= alert.targetPrice) {
          console.log(`Alert triggered for product ${product._id}, price: ${product.currentPrice}, target: ${alert.targetPrice}`);
          
          // Send email notification
          if (user.preferences.emailNotifications) {
            const emailResult = await exports.sendPriceAlertEmail(user, product, alert);
            results.push({
              userId: user._id,
              productId: product._id,
              alertId: alert._id,
              type: 'email',
              success: emailResult.success
            });
          }
          
          // Mark alert as notified
          alert.notificationSent = true;
          
          // Save changes to user document
          await user.save();
        }
      }
    }
    
    console.log(`Completed alert check, processed ${results.length} notifications`);
    return {
      success: true,
      alertsChecked: users.reduce((total, user) => total + user.alerts.length, 0),
      notificationsSent: results.length,
      results
    };
  } catch (error) {
    console.error('Error checking price alerts:', error);
    return { success: false, error: error.message };
  }
}; 