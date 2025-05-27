const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const { isGuest, isAuthenticated, isNotBanned } = require('../middleware/authMiddleware');
router.get('/register', isGuest, (req, res) => {
    res.render('auth/register', { title: 'Register' });
});

router.post('/register', isGuest, async (req, res) => {
    const { username, email, password, confirmPassword, role, whatsappNumber } = req.body;

    if (password !== confirmPassword) {
        req.flash('message', { type: 'error', text: 'Passwords do not match.' });
        return res.render('auth/register', { title: 'Register', formData: req.body });
    }
    if (role === 'seller' && !whatsappNumber) {
        req.flash('message', { type: 'error', text: 'WhatsApp number is required for sellers.' });
        return res.render('auth/register', { title: 'Register', formData: req.body });
    }

    try {
        let user = await User.findOne({ $or: [{ email }, { username }] });
        if (user) {
            req.flash('message', { type: 'error', text: 'User with this email or username already exists.' });
            return res.render('auth/register', { title: 'Register', formData: req.body });
        }

        const newUser = new User({
            username,
            email,
            password,
            role: role || 'buyer',
            whatsappNumber: role === 'seller' ? whatsappNumber : undefined
        });
        await newUser.save();
        req.flash('message', { type: 'success', text: 'Registration successful! Please login.' });
        res.redirect('/auth/login');
    } catch (err) {
        console.error("Registration error:", err);
        req.flash('message', { type: 'error', text: 'An error occurred during registration. ' + err.message });
        res.render('auth/register', { title: 'Register', formData: req.body });
    }
});

router.get('/login', isGuest, (req, res) => {
    res.render('auth/login', { title: 'Login' });
});

router.post('/login', isGuest, async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            req.flash('message', { type: 'error', text: 'Invalid email or password.' });
            return res.render('auth/login', { title: 'Login', email });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            req.flash('message', { type: 'error', text: 'Invalid email or password.' });
            return res.render('auth/login', { title: 'Login', email });
        }

        if (user.isBanned) {
            req.flash('message', { type: 'error', text: 'Your account has been banned. Please contact support.' });
            return res.render('auth/login', { title: 'Login', email });
        }

        req.session.userId = user._id;
        req.session.userRole = user.role;

        const returnTo = req.session.returnTo || '/';
        delete req.session.returnTo;
        req.flash('message', { type: 'success', text: `Welcome back, ${user.username}!`});
        res.redirect(returnTo);

    } catch (err) {
        console.error("Login error:", err);
        req.flash('message', { type: 'error', text: 'An error occurred during login. ' + err.message });
        res.render('auth/login', { title: 'Login', email });
    }
});

router.get('/logout', isAuthenticated, (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Logout error:", err);
            req.flash('message', { type: 'error', text: 'Could not log you out, please try again.' });
            return res.redirect('/');
        }
        res.clearCookie('connect.sid');
        req.flash('message', { type: 'success', text: 'You have been logged out successfully.' });
        res.redirect('/auth/login');
    });
});

module.exports = router;