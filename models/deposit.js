const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    forestApiId: { // The ID returned by ForestAPI for this transaction
        type: String,
        unique: true,
        sparse: true // Allows multiple nulls, but unique if value exists
    },
    reffId: { // Our internal reference ID sent to ForestAPI
        type: String,
        required: true,
        unique: true
    },
    method: {
        type: String,
        required: true
    },
    amount: { // The nominal amount requested by user
        type: Number,
        required: true
    },
    fee: { // Fee charged by ForestAPI
        type: Number,
        required: true,
        default: 0
    },
    netAmount: { // Amount to be credited to user (amount - fee if fee_by_customer=false, or just amount)
        type: Number,
        required: true
    },
    qrImageUrl: {
        type: String
    },
    qrImageString: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'success', 'failed', 'expired', 'processing'],
        default: 'pending',
        required: true
    },
    expiresAt: {
        type: Date
    },
    apiResponse: { // Store the raw API response for debugging/auditing
        type: mongoose.Schema.Types.Mixed
    }
}, { timestamps: true });

module.exports = mongoose.model('Deposit', depositSchema);