const mongoose = require('mongoose');

const connectDB = async () => {
  const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sale-snipe';
  console.log('Attempting to connect to MongoDB...');
  console.log(`Database URI: ${dbUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`); // Hide credentials if present

  try {
    const conn = await mongoose.connect(dbUri);
    console.log('MongoDB Connection Details:');
    console.log(`Host: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
    console.log(`State: ${conn.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
    
    // Handle connection events
    mongoose.connection.on('error', err => {
      console.error('MongoDB connection error:', err);
      console.error('Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected, attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected successfully');
    });

    // Monitor connection state changes
    mongoose.connection.on('connecting', () => {
      console.log('Establishing connection to MongoDB...');
    });

    mongoose.connection.on('connected', () => {
      console.log('MongoDB connected successfully');
    });

    mongoose.connection.on('disconnecting', () => {
      console.log('Disconnecting from MongoDB...');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Received SIGINT signal, closing MongoDB connection...');
      try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed through app termination');
        process.exit(0);
      } catch (err) {
        console.error('Error during MongoDB connection closure:', err);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('MongoDB connection error details:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
    console.error('Connection URI:', dbUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials in logs
    process.exit(1);
  }
};

module.exports = connectDB; 