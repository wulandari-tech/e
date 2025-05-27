const User = require('../models/user');
const Product = require('../models/product');

exports.isAuthenticated = (req, res, next) => {
    if (req.session.userId && res.locals.currentUser && !res.locals.currentUser.isBanned) {
        return next();
    }
    let message = 'You must be signed in first!';
    if (res.locals.currentUser && res.locals.currentUser.isBanned) {
        message = 'Your account has been banned. Please contact support.';
        req.session.destroy();
    }
    if (req.originalUrl !== '/auth/login' && req.originalUrl !== '/auth/register') {
        req.session.returnTo = req.originalUrl;
    }
    res.redirect(`/auth/login?message=${encodeURIComponent(message)}`);
};

exports.isGuest = (req, res, next) => {
    if (!req.session.userId) {
        return next();
    }
    res.redirect('/');
};

exports.isSeller = async (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/auth/login?message=Please login to continue.');
    }
    try {
        const user = await User.findById(req.session.userId);
        if (user && (user.role === 'seller' || user.role === 'admin') && !user.isBanned) {
            res.locals.currentUser = user;
            req.user = user;
            return next();
        }
        if (user && user.isBanned) {
             req.session.destroy();
             return res.redirect('/auth/login?message=Your account has been banned.');
        }
        res.status(403).render('403', { title: 'Forbidden - Seller Access Required', currentUser: req.user, layout: 'layouts/main' });
    } catch (error) {
        console.error("Error in isSeller middleware:", error);
        res.status(500).render('500', { title: 'Server Error', currentUser: req.user, layout: 'layouts/main' });
    }
};

exports.isAdmin = async (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/auth/login?message=Please login to continue.');
    }
    try {
        const user = await User.findById(req.session.userId);
        if (user && user.role === 'admin' && !user.isBanned) {
            res.locals.currentUser = user;
            req.user = user;
            return next();
        }
        if (user && user.isBanned) {
             req.session.destroy();
             return res.redirect('/auth/login?message=Your account has been banned.');
        }
        res.status(403).render('403', { title: 'Forbidden - Admin Access Required', currentUser: req.user, layout: 'layouts/main' });
    } catch (error) {
        console.error("Error in isAdmin middleware:", error);
        res.status(500).render('500', { title: 'Server Error', currentUser: req.user, layout: 'layouts/main' });
    }
};

exports.isOwnerOrAdmin = async (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/auth/login?message=Please login to continue.');
    }
    try {
        const user = await User.findById(req.session.userId);
        if (!user || user.isBanned) {
            req.session.destroy();
            return res.redirect('/auth/login?message=Your account is inactive or banned.');
        }
        res.locals.currentUser = user;
        req.user = user;

        if (user.role === 'admin') {
            return next();
        }

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).render('404', { title: 'Product Not Found', currentUser: req.user, layout: 'layouts/main' });
        }

        if (product.seller.toString() === req.session.userId) {
            return next();
        }

        res.status(403).render('403', { title: 'Forbidden - Not Your Product', currentUser: req.user, layout: 'layouts/main' });

    } catch (error) {
        console.error("Error in isOwnerOrAdmin middleware:", error);
        if (error.kind === 'ObjectId' && req.params.id) {
            return res.status(404).render('404', { title: 'Invalid Product ID format', currentUser: req.user, layout: 'layouts/main' });
        }
        res.status(500).render('500', { title: 'Server Error', currentUser: req.user, layout: 'layouts/main' });
    }
};

exports.isNotBanned = async (req, res, next) => {
    if (req.session.userId && res.locals.currentUser) {
      if (res.locals.currentUser.isBanned) {
        req.session.destroy((err) => {
          if (err) console.error("Session destroy error:", err);
          return res.redirect('/auth/login?message=Your account has been banned.');
        });
        return;
      }
    } else if (req.session.userId && !res.locals.currentUser) {
        try {
            const user = await User.findById(req.session.userId);
            if (user && user.isBanned) {
                req.session.destroy((err) => {
                    if (err) console.error("Session destroy error:", err);
                    return res.redirect('/auth/login?message=Your account has been banned.');
                });
                return;
            } else if (!user) {
                req.session.destroy();
                return res.redirect('/auth/login?message=User account not found.');
            }
        } catch (error) {
            console.error("Error in isNotBanned fallback check:", error);
        }
    }
    next();
};

exports.handleQueryMessages = (req, res, next) => {
    if (req.query.message && (!res.locals.message || (typeof res.locals.message === 'object' && !res.locals.message.text) )) {
        let type = 'info';
        const lowerMessage = req.query.message.toLowerCase();
        if (lowerMessage.includes('error') || lowerMessage.includes('forbidden') || lowerMessage.includes('banned') || lowerMessage.includes('failed') || lowerMessage.includes('invalid')) {
            type = 'error';
        } else if (lowerMessage.includes('success') || lowerMessage.includes('updated') || lowerMessage.includes('created')) {
            type = 'success';
        }
        res.locals.message = { type: type, text: req.query.message };
    }
    next();
};