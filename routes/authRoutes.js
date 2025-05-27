const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const { isGuest, isAuthenticated } = require('../middleware/authMiddleware');

router.get('/register', isGuest, (req, res) => {
    console.log("[GET /auth/register] Rendering registration page.");
    res.render('auth/register', { title: 'Register' });
});

router.post('/register', isGuest, async (req, res) => {
    const { username, email, password, confirmPassword, role, whatsappNumber } = req.body;
    console.log("[POST /auth/register] Attempting registration for:", username, email);

    if (password !== confirmPassword) {
        req.flash('message', { type: 'error', text: 'Passwords do not match.' });
        console.log("[POST /auth/register] Passwords mismatch.");
        return res.render('auth/register', { title: 'Register', formData: req.body });
    }
    if (role === 'seller' && !whatsappNumber) {
        req.flash('message', { type: 'error', text: 'WhatsApp number is required for sellers.' });
        console.log("[POST /auth/register] WhatsApp required for seller.");
        return res.render('auth/register', { title: 'Register', formData: req.body });
    }

    try {
        let user = await User.findOne({ $or: [{ email }, { username }] });
        if (user) {
            req.flash('message', { type: 'error', text: 'User with this email or username already exists.' });
            console.log("[POST /auth/register] User already exists.");
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
        console.log(`[POST /auth/register] Registration successful for ${username}, redirecting to /auth/login`);
        res.redirect('/auth/login');
    } catch (err) {
        console.error("[POST /auth/register] Registration error:", err);
        req.flash('message', { type: 'error', text: 'An error occurred during registration. ' + err.message });
        res.render('auth/register', { title: 'Register', formData: req.body });
    }
});

router.get('/login', isGuest, (req, res) => {
    console.log("[GET /auth/login] Rendering login page.");
    res.render('auth/login', { title: 'Login' });
});

router.post('/login', isGuest, async (req, res) => {
    const { email, password } = req.body;
    console.log("[POST /auth/login] Attempting login for:", email);
    try {
        const user = await User.findOne({ email });
        if (!user) {
            req.flash('message', { type: 'error', text: 'Invalid email or password.' });
            console.log("[POST /auth/login] User not found:", email);
            return res.render('auth/login', { title: 'Login', email });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            req.flash('message', { type: 'error', text: 'Invalid email or password.' });
            console.log("[POST /auth/login] Password mismatch for:", email);
            return res.render('auth/login', { title: 'Login', email });
        }

        if (user.isBanned) {
            req.flash('message', { type: 'error', text: 'Your account has been banned. Please contact support.' });
            console.log("[POST /auth/login] Account banned for:", email);
            return res.render('auth/login', { title: 'Login', email });
        }

        req.session.userId = user._id;
        req.session.userRole = user.role;
        console.log(`[POST /auth/login] Session userId set: ${req.session.userId} for ${user.username}`);

        const returnTo = req.session.returnTo || '/';
        delete req.session.returnTo;
        req.flash('message', { type: 'success', text: `Welcome back, ${user.username}!`});
        console.log(`[POST /auth/login] Login successful for ${user.username}, redirecting to ${returnTo}. Session ID: ${req.sessionID}`);
        res.redirect(returnTo);

    } catch (err) {
        console.error("[POST /auth/login] Login error:", err);
        req.flash('message', { type: 'error', text: 'An error occurred during login. ' + err.message });
        res.render('auth/login', { title: 'Login', email });
    }
});

router.get('/logout', isAuthenticated, (req, res) => {
    const username = req.user ? req.user.username : 'User';
    console.log(`[GET /auth/logout] Attempting logout for: ${username}`);
    req.session.destroy(err => {
        if (err) {
            console.error("[GET /auth/logout] Logout error:", err);
            req.flash('message', { type: 'error', text: 'Could not log you out, please try again.' });
            return res.redirect('/');
        }
        res.clearCookie('connect.sid'); // Default session cookie name
        req.flash('message', { type: 'success', text: 'You have been logged out successfully.' });
        console.log(`[GET /auth/logout] Logout successful for: ${username}. Redirecting to /auth/login`);
        res.redirect('/auth/login');
    });
});

module.exports = router;