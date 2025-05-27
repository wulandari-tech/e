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

console.log("-----------------------------------------");
console.log("SERVER CONFIG - DEBUG INFO");
const nodeEnv = process.env.NODE_ENV;
console.log(`NODE_ENV: ${nodeEnv}`);
const isProduction = nodeEnv === "production";
console.log(`Derived isProduction for cookie.secure: ${isProduction}`);
console.log("-----------------------------------------");

const sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions_app',
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
        secure: isProduction,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        sameSite: 'lax'
    }
}));

app.use(flash());

app.use(async (req, res, next) => {
    console.log(`[REQ START] ${req.method} ${req.originalUrl} - Session ID: ${req.sessionID}, Session UserId: ${req.session.userId}`);
    if (req.session.userId) {
        try {
            const user = await User.findById(req.session.userId).select('-password');
            if (user && !user.isBanned) {
                res.locals.currentUser = user;
                req.user = user;
                console.log(`[AUTH] CurrentUser populated: ${user.username}`);
            } else {
                if (user && user.isBanned) {
                    console.log(`[AUTH] User ${user.username} is banned. Destroying session.`);
                    req.flash('message', { type: 'error', text: 'Your account has been banned.' });
                } else {
                    console.log(`[AUTH] User not found for session ID. Destroying session.`);
                }
                req.session.destroy();
                res.locals.currentUser = null;
                req.user = null;
            }
        } catch (error) {
            console.error("[AUTH] Error fetching user for session:", error);
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
        console.log(`[FLASH] Message set from flash: ${JSON.stringify(res.locals.message)}`);
    } else if (flashMessages.success && flashMessages.success.length > 0) {
        res.locals.message = { type: 'success', text: flashMessages.success[0] };
        console.log(`[FLASH] Success message set from flash: ${JSON.stringify(res.locals.message)}`);
    } else if (flashMessages.error && flashMessages.error.length > 0) {
        res.locals.message = { type: 'error', text: flashMessages.error[0] };
        console.log(`[FLASH] Error message set from flash: ${JSON.stringify(res.locals.message)}`);
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
    console.log(`[404] Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).render('404', {
        title: 'Page Not Found',
        layout: 'layouts/main',
        currentUser: res.locals.currentUser
    });
});

app.use((err, req, res, next) => {
    console.error(`[ERROR HANDLER] Path: ${req.path}, Message: ${err.message}`);
    console.error(err.stack);

    const statusCode = err.status || 500;
    const displayMessage = (isProduction && statusCode === 500)
        ? 'An unexpected error occurred. Please try again later.'
        : err.message;

    res.status(statusCode).render('500', {
        title: 'Server Error',
        error: { message: displayMessage },
        layout: 'layouts/main',
        currentUser: res.locals.currentUser
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Node environment: ${nodeEnv}`);
});