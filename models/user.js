const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required.'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters long.'],
        maxlength: [30, 'Username cannot exceed 30 characters.']
    },
    email: {
        type: String,
        required: [true, 'Email is required.'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/.+\@.+\..+/, 'Please enter a valid email address.']
    },
    password: {
        type: String,
        required: [true, 'Password is required.'],
        minlength: [6, 'Password must be at least 6 characters long.']
    },
    role: {
        type: String,
        enum: {
            values: ['buyer', 'seller', 'admin'],
            message: '{VALUE} is not a supported role.'
        },
        default: 'buyer'
    },
    whatsappNumber: {
        type: String,
        trim: true,
        // Basic validation, can be improved with a more specific regex
        validate: {
            validator: function(v) {
                if (this.role === 'seller' && (!v || v.trim() === '')) {
                    return false; // Required if role is seller
                }
                if (v && v.trim() !== '') { // If provided, validate format
                    return /^\+?[1-9]\d{1,14}$/.test(v) || /^[0-9]{10,15}$/.test(v);
                }
                return true; // Not required if not seller and not provided
            },
            message: props => {
                if (this.role === 'seller' && (!props.value || props.value.trim() === '')) {
                    return 'WhatsApp number is required for sellers.';
                }
                return `${props.value} is not a valid WhatsApp number format! Use international format (e.g., 628123...) or local (08123...).`;
            }
        }
    },
    avatarUrl: {
        type: String,
        default: '/img/default-avatar.png'
    },
    avatarCloudinaryId: {
        type: String
    },
    isBanned: {
        type: Boolean,
        default: false
    },
    balance: {
        type: Number,
        default: 0,
        min: [0, 'Balance cannot be negative.']
    },
    products: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    resetPasswordToken: String,
    resetPasswordExpires: Date,
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

const User = mongoose.model('User', userSchema);

module.exports = User;