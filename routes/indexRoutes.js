const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const { isNotBanned } = require('../middleware/authMiddleware');


router.get('/', isNotBanned, async (req, res) => {
    try {
        const products = await Product.find({ status: 'approved' })
            .populate('seller', 'username whatsappNumber avatarUrl')
            .sort({ createdAt: -1 })
            .limit(12);
        res.render('index', {
            title: 'Welcome',
            products,
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('500', { title: 'Server Error', error: err });
    }
});

module.exports = router;