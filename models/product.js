const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  originalPrice: { 
    type: Number,
  },
  imageUrl: { // Gambar utama/cover
    type: String,
    required: true,
  },
  images: [{ // Untuk galeri gambar tambahan
    type: String,
  }],
  category: {
    type: String,
    trim: true,
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  verifiedBy: {
    type: String,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  stock: {
    type: Number,
    default: 1, // Asumsi default stok 1 jika tidak dispesifikkan
  },
  views: {
      type: Number,
      default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

ProductSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Product', ProductSchema);