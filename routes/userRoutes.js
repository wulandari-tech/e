const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Product = require('../models/product');
const { isAuthenticated, isSeller, isNotBanned } = require('../middleware/authMiddleware');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.diskStorage({});
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image! Please upload only images.'), false);
        }
    },
    limits: { fileSize: 2 * 1024 * 1024 }
});


router.get('/dashboard', isAuthenticated, isSeller, (req, res) => {
    res.render('user/dashboard', {
        title: 'Seller Dashboard',
        user: req.user
    });
});

router.get('/my-products', isAuthenticated, isSeller, async (req, res) => {
    try {
        const products = await Product.find({ seller: req.user._id }).sort({ createdAt: -1 });
        res.render('user/my_products', {
            title: 'My Products',
            products
        });
    } catch (err) {
        console.error(err);
        req.flash('message', { type: 'error', text: 'Could not fetch your products.' });
        res.redirect('/user/dashboard');
    }
});

router.get('/profile', isAuthenticated, isNotBanned, (req, res) => {
    res.render('user/profile', {
        title: 'My Profile',
    });
});

router.post('/profile', isAuthenticated, isNotBanned, async (req, res) => {
    const { username, email, whatsappNumber } = req.body;
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            req.flash('message', { type: 'error', text: 'User not found.' });
            return res.redirect('/auth/logout');
        }

        if (username !== user.username) {
            const existingUsername = await User.findOne({ username: username, _id: { $ne: user._id } });
            if (existingUsername) {
                req.flash('message', { type: 'error', text: 'Username already taken.' });
                return res.redirect('/user/profile');
            }
            user.username = username;
        }
        if (email !== user.email) {
            const existingEmail = await User.findOne({ email: email, _id: { $ne: user._id } });
            if (existingEmail) {
                req.flash('message', { type: 'error', text: 'Email already registered.' });
                return res.redirect('/user/profile');
            }
            user.email = email;
        }

        if (user.role === 'seller') {
            user.whatsappNumber = whatsappNumber || user.whatsappNumber;
        }

        await user.save();
        req.flash('message', { type: 'success', text: 'Profile updated successfully.' });
        res.redirect('/user/profile');
    } catch (err) {
        console.error("Profile update error:", err);
        req.flash('message', { type: 'error', text: 'Error updating profile: ' + err.message });
        res.redirect('/user/profile');
    }
});

router.post('/profile/avatar', isAuthenticated, isNotBanned, upload.single('avatar'), async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            req.flash('message', { type: 'error', text: 'User not found.' });
            return res.redirect('/auth/logout');
        }
        if (!req.file) {
            req.flash('message', { type: 'error', text: 'No image file selected for avatar.'});
            return res.redirect('/user/profile');
        }

        if (user.avatarCloudinaryId) {
            await cloudinary.uploader.destroy(user.avatarCloudinaryId);
        }

        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'e-commerce-wanzofc/avatars',
            transformation: [{ width: 200, height: 200, crop: "fill", gravity: "face" }]
        });

        user.avatarUrl = result.secure_url;
        user.avatarCloudinaryId = result.public_id;
        await user.save();

        req.flash('message', { type: 'success', text: 'Avatar updated successfully.' });
        res.redirect('/user/profile');
    } catch (err) {
        console.error("Avatar upload error:", err);
        req.flash('message', { type: 'error', text: 'Error updating avatar: ' + err.message });
        res.redirect('/user/profile');
    }
});

router.post('/profile/password', isAuthenticated, isNotBanned, async (req, res) => {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            req.flash('message', { type: 'error', text: 'User not found.' });
            return res.redirect('/auth/logout');
        }

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            req.flash('message', { type: 'error', text: 'Incorrect current password.' });
            return res.redirect('/user/profile#change-password');
        }

        if (newPassword !== confirmNewPassword) {
            req.flash('message', { type: 'error', text: 'New passwords do not match.' });
            return res.redirect('/user/profile#change-password');
        }

        if (newPassword.length < 6) {
             req.flash('message', {type: 'error', text: 'New password must be at least 6 characters long.'});
             return res.redirect('/user/profile#change-password');
        }

        user.password = newPassword;
        await user.save();
        req.flash('message', { type: 'success', text: 'Password changed successfully.' });
        res.redirect('/user/profile');
    } catch (err) {
        console.error("Password change error:", err);
        req.flash('message', { type: 'error', text: 'Error changing password: ' + err.message });
        res.redirect('/user/profile#change-password');
    }
});


module.exports = router;