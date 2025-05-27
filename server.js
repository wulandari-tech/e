require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const expressEjsLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const path = require('path');

const User = require('./models/user');
const Product = require('./models/product');
const Deposit = require('./models/deposit');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');
const indexRoutes = require('./routes/indexRoutes');
const adminRoutes = require('./routes/adminRoutes');
const walletRoutes = require('./routes/walletRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Connected...'))
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
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60
});

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 7
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
                req.session.destroy();
                res.locals.currentUser = null;
                req.user = null;
            }
        } catch (error) {
            console.error("Error fetching user for session:", error);
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
    } else {
        res.locals.message = null;
    }
    next();
});

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/user', userRoutes);
app.use('/admin', adminRoutes);
app.use('/wallet', walletRoutes);

app.get('/', async (req, res) => {
    try {
        const products = await Product.find({ status: 'approved' })
            .populate('seller', 'username whatsappNumber avatarUrl')
            .sort({ createdAt: -1 })
            .limit(12);
        res.render('index', {
            title: 'Welcome',
            products
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('500', { title: 'Server Error', error: err, layout: 'layouts/main' });
    }
});

app.use((req, res, next) => {
    res.status(404).render('404', { title: 'Page Not Found', layout: 'layouts/main' });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    const errorDetails = {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    };
    res.status(err.status || 500).render('500', {
        title: 'Server Error',
        error: errorDetails,
        layout: 'layouts/main'
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    if (process.env.NODE_ENV !== 'production') {
        console.log(`Development server: http://localhost:${PORT}`);
    }
});