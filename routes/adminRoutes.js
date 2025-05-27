const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Product = require('../models/product');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

router.get('/dashboard', isAuthenticated, isAdmin, (req, res) => {
    res.render('admin/dashboard', {
        title: 'Admin Dashboard'
    });
});

router.get('/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.user._id } }).sort({ createdAt: -1 }); // Exclude current admin
        res.render('admin/users', {
            title: 'Manage Users',
            users
        });
    } catch (err) {
        console.error(err);
        req.flash('message', { type: 'error', text: 'Could not fetch users.' });
        res.redirect('/admin/dashboard');
    }
});

router.put('/users/:id/ban', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user && user._id.toString() !== req.user._id.toString()) { // Admin cannot ban themselves
            user.isBanned = true;
            await user.save();
            req.flash('message', { type: 'success', text: `User ${user.username} has been banned.` });
        } else if (user && user._id.toString() === req.user._id.toString()) {
            req.flash('message', { type: 'error', text: 'You cannot ban yourself.' });
        }
        else {
            req.flash('message', { type: 'error', text: 'User not found.' });
        }
        res.redirect('/admin/users');
    } catch (err) {
        console.error(err);
        req.flash('message', { type: 'error', text: 'Error banning user.' });
        res.redirect('/admin/users');
    }
});

router.put('/users/:id/unban', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            user.isBanned = false;
            await user.save();
            req.flash('message', { type: 'success', text: `User ${user.username} has been unbanned.` });
        } else {
            req.flash('message', { type: 'error', text: 'User not found.' });
        }
        res.redirect('/admin/users');
    } catch (err) {
        console.error(err);
        req.flash('message', { type: 'error', text: 'Error unbanning user.' });
        res.redirect('/admin/users');
    }
});

router.get('/products-approval', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const products = await Product.find({ status: 'pending' }).populate('seller', 'username email').sort({ createdAt: 1 });
        res.render('admin/products_approval', {
            title: 'Products for Approval',
            products
        });
    } catch (err) {
        console.error(err);
        req.flash('message', { type: 'error', text: 'Could not fetch products for approval.' });
        res.redirect('/admin/dashboard');
    }
});

router.put('/products/:id/approve', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            product.status = 'approved';
            product.verifiedBy = req.user.username;
            await product.save();
            req.flash('message', { type: 'success', text: `Product "${product.name}" approved.` });
        } else {
            req.flash('message', { type: 'error', text: 'Product not found.' });
        }
        res.redirect('/admin/products-approval');
    } catch (err) {
        console.error(err);
        req.flash('message', { type: 'error', text: 'Error approving product.' });
        res.redirect('/admin/products-approval');
    }
});

router.put('/products/:id/reject', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            product.status = 'rejected';
            await product.save();
            req.flash('message', { type: 'success', text: `Product "${product.name}" rejected.` });
        } else {
            req.flash('message', { type: 'error', text: 'Product not found.' });
        }
        res.redirect('/admin/products-approval');
    } catch (err) {
        console.error(err);
        req.flash('message', { type: 'error', text: 'Error rejecting product.' });
        res.redirect('/admin/products-approval');
    }
});


module.exports = router;