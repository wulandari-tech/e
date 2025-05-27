require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const path = require('path');
const expressEjsLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');
const User = require('./models/user');
const Product = require('./models/product');
const { handleQueryMessages } = require('./middleware/authMiddleware');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const walletRoutes = require('./routes/walletRoutes');
const indexRoutes = require('./routes/indexRoutes'); 
const app = express();
const PORT = process.env.PORT || 3000; 
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Connected.'))
    .catch(err => console.error('MongoDB Connection Error:', err));

app.set('view engine', 'ejs');
app.use(expressEjsLayouts);
app.set('layout', 'layouts/main');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));

const sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions_prod', 
    ttl: 14 * 24 * 60 * 60, 
    crypto: { 
        secret: process.env.SESSION_STORE_SECRET || process.env.SESSION_SECRET
    }
});

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", 
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
        sameSite: 'lax' // Helps prevent CSRF
    }
}));

app.use(flash());

app.use(async (req, res, next) => {
    if (req.session.userId) {
        try {
            const user = await User.findById(req.session.userId).select('-password');
            if (user && !user.isBanned) {
                res.locals.currentUser = user;
                req.user = user;
            } else {
                if (user && user.isBanned) {
                    req.flash('message', { type: 'error', text: 'Your account has been banned.' });
                }
                req.session.destroy();
                res.locals.currentUser = null;
                req.user = null;
            }
        } catch (error) {
            console.error("Session user fetch error:", error);
            res.locals.currentUser = null;
            req.user = null;
        }
    } else {
        res.locals.currentUser = null;
        req.user = null;
    }

    const flashMessages = req.flash();
    if (flashMessages.message && flashMessages.message.length > 0) {
        res.locals.message = flashMessages.message[0];
    } else if (flashMessages.success && flashMessages.success.length > 0) {
        res.locals.message = { type: 'success', text: flashMessages.success[0] };
    } else if (flashMessages.error && flashMessages.error.length > 0) {
        res.locals.message = { type: 'error', text: flashMessages.error[0] };
    }
    next();
});

app.use(handleQueryMessages);

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/user', userRoutes);
app.use('/admin', adminRoutes);
app.use('/wallet', walletRoutes);

app.use((req, res, next) => {
    res.status(404).render('404', {
        title: 'Page Not Found',
        layout: 'layouts/main',
        currentUser: res.locals.currentUser
    });
});

app.use((err, req, res, next) => {
    console.error("Global Error Handler:", err.message);
    console.error(err.stack); // Log stack for server-side debugging

    const statusCode = err.status || 500;
    const errorMessage = process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'An unexpected error occurred. Please try again later.'
        : err.message;

    res.status(statusCode).render('500', {
        title: 'Server Error',
        error: { message: errorMessage }, // Only send limited error info to client in prod
        layout: 'layouts/main',
        currentUser: res.locals.currentUser
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Node environment: ${process.env.NODE_ENV}`);
});