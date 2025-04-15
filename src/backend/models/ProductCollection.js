const mongoose = require('mongoose');

const productCollectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

const ProductCollection = mongoose.model('ProductCollection', productCollectionSchema);

module.exports = ProductCollection; 