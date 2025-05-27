const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const Product = require('../models/product');
const { isAuthenticated, isSeller, isAdmin, isOwnerOrAdmin, isNotBanned } = require('../middleware/authMiddleware');

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
    limits: { fileSize: 5 * 1024 * 1024 }
});


router.get('/', isNotBanned, async (req, res, next) => {
    try {
        const products = await Product.find({ status: 'approved' }).populate('seller', 'username avatarUrl whatsappNumber');
        res.render('products/index', {
            title: 'All Products',
            products,
        });
    } catch (err) {
        console.error("Error fetching all products:", err);
        next(err);
    }
});

router.get('/new', isAuthenticated, isSeller, (req, res) => {
    res.render('products/new', {
        title: 'Add New Product',
    });
});

router.post('/', isAuthenticated, isSeller, upload.single('productImage'), async (req, res, next) => {
    try {
        const { name, description, price, category } = req.body;
        if (!req.file) {
            req.flash('message', { type: 'error', text: 'Product image is required.' });
            return res.redirect('/products/new');
        }
        if (!name || !description || !price) {
            req.flash('message', { type: 'error', text: 'Name, description, and price are required fields.' });
            return res.redirect('/products/new');
        }

        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'e-commerce-wanzofc/products',
            transformation: [{ width: 800, height: 800, crop: "limit" }]
        });

        const newProduct = new Product({
            name,
            description,
            price: parseFloat(price),
            category: category || 'Uncategorized',
            imageUrl: result.secure_url,
            cloudinaryId: result.public_id,
            seller: req.user._id,
            status: req.user.role === 'admin' ? 'approved' : 'pending',
            verifiedBy: req.user.role === 'admin' ? req.user.username : null
        });
        await newProduct.save();
        req.flash('message', { type: 'success', text: 'Product submitted! It will be reviewed by an admin if you are not an admin.' });
        res.redirect('/user/my-products');
    } catch (err) {
        console.error("Error creating product:", err);
        if (err.name === 'ValidationError') {
            req.flash('message', { type: 'error', text: 'Validation Error: ' + Object.values(err.errors).map(e => e.message).join(', ') });
            return res.redirect('/products/new');
        }
        next(err);
    }
});

router.get('/search', isNotBanned, async (req, res, next) => {
    try {
        const query = req.query.q;
        if (!query || query.trim() === "") {
            return res.redirect('/products');
        }
        const products = await Product.find({
            status: 'approved',
            $text: { $search: query } // Using text index for better search
        }, {
            score: { $meta: "textScore" } // For sorting by relevance if text index is used
        }).sort({ score: { $meta: "textScore" } }).populate('seller', 'username avatarUrl whatsappNumber');


        if (products.length === 0) {
             const regexProducts = await Product.find({
                status: 'approved',
                $or: [
                    { name: { $regex: query, $options: 'i' } },
                    { category: { $regex: query, $options: 'i' } },
                    { description: { $regex: query, $options: 'i' } }
                ]
            }).populate('seller', 'username avatarUrl whatsappNumber');
             res.render('products/index', {
                title: `Search Results for "${query}"`,
                products: regexProducts,
                searchQuery: query
            });
            return;
        }


        res.render('products/index', {
            title: `Search Results for "${query}"`,
            products,
            searchQuery: query
        });
    } catch (err) {
        console.error("Error searching products:", err);
        next(err);
    }
});


router.get('/:id', isNotBanned, async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id).populate('seller', 'username email whatsappNumber avatarUrl');
        if (!product || (product.status !== 'approved' && (!req.user || (req.user.role !== 'admin' && product.seller._id.toString() !== req.user._id.toString())))) {
            return res.status(404).render('404', { title: 'Product Not Found' });
        }
        res.render('products/show', {
            title: product.name,
            product
        });
    } catch (err) {
        console.error("Error fetching single product:", err);
        if (err.kind === 'ObjectId') {
            return res.status(404).render('404', { title: 'Product Not Found (Invalid ID)' });
        }
        next(err);
    }
});


router.get('/:id/edit', isAuthenticated, isOwnerOrAdmin, async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            req.flash('message', { type: 'error', text: 'Product not found.' });
            return res.redirect('/user/my-products');
        }
        res.render('products/edit', {
            title: 'Edit Product',
            product,
        });
    } catch (err) {
        console.error("Error loading product for edit:", err);
        req.flash('message', { type: 'error', text: 'Error loading product for edit.' });
        next(err);
    }
});

router.put('/:id', isAuthenticated, isOwnerOrAdmin, upload.single('productImage'), async (req, res, next) => {
    try {
        const { name, description, price, category } = req.body;
        const product = await Product.findById(req.params.id);

        if (!product) {
            req.flash('message', { type: 'error', text: 'Product not found.' });
            return res.redirect('/user/my-products');
        }
        if (!name || !description || !price) {
            req.flash('message', { type: 'error', text: 'Name, description, and price are required fields.' });
            return res.redirect(`/products/${req.params.id}/edit`);
        }

        product.name = name;
        product.description = description;
        product.price = parseFloat(price);
        product.category = category || product.category;

        if (req.user.role !== 'admin' || product.seller.toString() === req.user._id.toString()) {
             product.status = 'pending';
             product.verifiedBy = null;
        }


        if (req.file) {
            if (product.cloudinaryId) {
                await cloudinary.uploader.destroy(product.cloudinaryId).catch(err => console.error("Cloudinary destroy error:", err));
            }
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: 'e-commerce-wanzofc/products',
                transformation: [{ width: 800, height: 800, crop: "limit" }]
            });
            product.imageUrl = result.secure_url;
            product.cloudinaryId = result.public_id;
        }

        await product.save();
        req.flash('message', { type: 'success', text: 'Product updated successfully. It may require re-approval if you are not an admin.' });
        res.redirect(`/products/${product._id}`);
    } catch (err) {
        console.error("Error updating product:", err);
        if (err.name === 'ValidationError') {
            req.flash('message', { type: 'error', text: 'Validation Error: ' + Object.values(err.errors).map(e => e.message).join(', ') });
            return res.redirect(`/products/${req.params.id}/edit`);
        }
        next(err);
    }
});


router.delete('/:id', isAuthenticated, isOwnerOrAdmin, async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            req.flash('message', { type: 'error', text: 'Product not found.' });
            return res.redirect(req.user.role === 'admin' ? '/admin/dashboard' : '/user/my-products');
        }

        if (product.cloudinaryId) {
            await cloudinary.uploader.destroy(product.cloudinaryId).catch(err => console.error("Cloudinary destroy error on delete:", err));
        }
        await Product.findByIdAndDelete(req.params.id);

        req.flash('message', { type: 'success', text: 'Product deleted successfully.' });
        if (req.user.role === 'admin' && product.seller.toString() !== req.user._id.toString()) {
             res.redirect('/admin/products-approval');
        } else {
             res.redirect('/user/my-products');
        }
    } catch (err) {
        console.error("Error deleting product:", err);
        next(err);
    }
});

module.exports = router;