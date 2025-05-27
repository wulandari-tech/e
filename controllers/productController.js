const Product = require('../models/product');
const User = require('../models/user'); 
const cloudinary = require('../config/cloudinary');
const fs = require('fs');
const path = require('path');

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: 'approved' })
                                  .populate('seller', 'username whatsappNumber avatarUrl')
                                  .sort({ createdAt: -1 });
    res.render('products/index', { 
        title: 'All Products', 
        products, 
        message: req.query.message || null 
    });
  } catch (err) {
    console.error("Error in getAllProducts:", err);
    res.status(500).render('500', { title: 'Server Error', error: err });
  }
};

exports.searchProducts = async (req, res) => {
    const query = req.query.q;
    try {
        let products = [];
        if (query && query.trim() !== "") {
            products = await Product.find({
                status: 'approved',
                $or: [
                    { name: { $regex: query, $options: 'i' } },
                    { description: { $regex: query, $options: 'i' } },
                    { category: { $regex: query, $options: 'i' } },
                    { tags: { $in: [new RegExp(query, 'i')] } }
                ]
            }).populate('seller', 'username whatsappNumber avatarUrl').sort({ createdAt: -1 });
        } else {
            // Jika query kosong, bisa redirect ke halaman produk utama atau tampilkan pesan
            return res.redirect('/products?message=Please enter a search term');
        }
        
        res.render('products/index', {
            title: `Search Results for "${query}"`,
            products,
            searchQuery: query,
            message: products.length === 0 ? `No products found matching "${query}"` : null
        });
    } catch (err) {
        console.error("Error in searchProducts:", err);
        res.status(500).render('500', { title: 'Server Error', error: err });
    }
};


exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true })
                                .populate({
                                    path: 'seller',
                                    select: 'username email whatsappNumber avatarUrl'
                                });

    if (!product || product.status !== 'approved') {
      return res.status(404).render('404', { title: 'Product Not Found' });
    }
    
    // Memastikan product.images ada dan tidak kosong sebelum digunakan di EJS
    // Jika images kosong tapi imageUrl ada, jadikan imageUrl sebagai satu-satunya gambar di array untuk galeri
    if (!product.images || product.images.length === 0) {
        if (product.imageUrl) {
            product.images = [product.imageUrl];
        } else {
            product.images = ['/img/default-product.png']; // Fallback jika tidak ada gambar sama sekali
        }
    }


    res.render('products/show', {
      title: product.name,
      product,
      message: null
    });
  } catch (err) {
    console.error("Error in getProductById:", err);
    if (err.kind === 'ObjectId') {
        return res.status(404).render('404', { title: 'Invalid Product ID' });
    }
    res.status(500).render('500', { title: 'Server Error', error: err });
  }
};

exports.getNewProductForm = (req, res) => {
  res.render('products/new', { 
    title: 'Add New Product', 
    product: {}, // Objek kosong untuk konsistensi form (jika ada form edit nantinya)
    message: null 
  });
};

exports.createProduct = async (req, res) => {
  const { name, description, price, originalPrice, category, stock, tags, verifiedBy } = req.body;
  
  if (!req.files || Object.keys(req.files).length === 0 || !req.files.productImage) {
    return res.status(400).render('products/new', {
      title: 'Add New Product',
      product: req.body,
      message: { type: 'error', text: 'Main product image is required' }
    });
  }

  try {
    const mainImageFile = req.files.productImage[0];
    const mainImageResult = await cloudinary.uploader.upload(mainImageFile.path, {
      folder: 'my_marketplace_products/main',
    });
    fs.unlinkSync(mainImageFile.path);

    let additionalImageUrls = [];
    if (req.files.additionalImages && req.files.additionalImages.length > 0) {
      for (const file of req.files.additionalImages) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'my_marketplace_products/additional',
        });
        additionalImageUrls.push(result.secure_url);
        fs.unlinkSync(file.path);
      }
    }

    const productData = {
      name,
      description,
      price: parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
      category,
      stock: stock ? parseInt(stock, 10) : 1,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      imageUrl: mainImageResult.secure_url,
      images: additionalImageUrls,
      seller: req.session.userId,
      status: req.session.userRole === 'admin' ? 'approved' : 'pending', // Admin bisa langsung approve
      verifiedBy: req.session.userRole === 'admin' ? (verifiedBy || 'StellarMarket Admin') : undefined,
    };

    const product = new Product(productData);
    await product.save();
    
    res.redirect(`/products/${product._id}?message=Product submitted successfully! It will be reviewed by an admin.`);
  } catch (err) {
    console.error("Error in createProduct:", err);
    if (req.files) { // Hapus file yang mungkin sudah terupload jika error
        if (req.files.productImage && req.files.productImage[0]) fs.unlink(req.files.productImage[0].path, () => {});
        if (req.files.additionalImages) req.files.additionalImages.forEach(f => fs.unlink(f.path, () => {}));
    }
    res.status(500).render('products/new', { 
        title: 'Add New Product',
        product: req.body,
        message: { type: 'error', text: 'Error creating product. ' + err.message }
    });
  }
};

exports.getEditProductForm = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).render('404', { title: 'Product Not Found'});
        }
        if (product.seller.toString() !== req.session.userId && req.session.userRole !== 'admin') {
            return res.status(403).render('403', { title: 'Forbidden - Not Your Product'});
        }
        res.render('products/edit', {
            title: 'Edit Product - ' + product.name,
            product,
            message: null
        });
    } catch (err) {
        console.error("Error in getEditProductForm:", err);
        res.status(500).render('500', { title: 'Server Error', error: err });
    }
};

exports.updateProduct = async (req, res) => {
    const { name, description, price, originalPrice, category, stock, tags, verifiedBy, existingImages } = req.body;
    const productId = req.params.id;

    try {
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).render('404', { title: 'Product Not Found'});
        }
        if (product.seller.toString() !== req.session.userId && req.session.userRole !== 'admin') {
            return res.status(403).render('403', { title: 'Forbidden - Not Your Product'});
        }

        product.name = name;
        product.description = description;
        product.price = parseFloat(price);
        product.originalPrice = originalPrice ? parseFloat(originalPrice) : undefined;
        product.category = category;
        product.stock = stock ? parseInt(stock, 10) : product.stock;
        product.tags = tags ? tags.split(',').map(tag => tag.trim()) : product.tags;
        
        if (req.session.userRole === 'admin') {
            product.verifiedBy = verifiedBy || product.verifiedBy;
            // Admin bisa mengubah status jika diperlukan
            // product.status = req.body.status || product.status; 
        }

        let currentImages = Array.isArray(existingImages) ? existingImages : (existingImages ? [existingImages] : []);
        
        // Hapus gambar dari Cloudinary jika tidak ada di existingImages dan ada di product.images sebelumnya
        const imagesToDeleteFromCloudinary = product.images.filter(imgUrl => !currentImages.includes(imgUrl));
        for (const imgUrl of imagesToDeleteFromCloudinary) {
            const publicId = imgUrl.substring(imgUrl.lastIndexOf('/') + 1, imgUrl.lastIndexOf('.'));
            // Anda mungkin perlu path folder yang benar di Cloudinary, contoh: 'my_marketplace_products/additional/' + publicId
            // Atau ekstrak public_id saat menyimpan jika Cloudinary menyediakannya.
            // Ini adalah bagian yang tricky dan butuh struktur public_id yang konsisten.
            // cloudinary.uploader.destroy('my_marketplace_products/additional/' + publicId, (error, result) => {
            //     if (error) console.error("Error deleting old image from Cloudinary:", error);
            // });
        }
        product.images = currentImages; // Set dulu dengan yang existing

        if (req.files) {
            if (req.files.productImage && req.files.productImage[0]) {
                // Hapus gambar utama lama dari Cloudinary jika ada
                // const oldMainImagePublicId = ... (logika untuk mendapatkan public_id)
                // cloudinary.uploader.destroy(oldMainImagePublicId)
                const mainImageFile = req.files.productImage[0];
                const mainImageResult = await cloudinary.uploader.upload(mainImageFile.path, {
                    folder: 'my_marketplace_products/main',
                });
                fs.unlinkSync(mainImageFile.path);
                product.imageUrl = mainImageResult.secure_url;
            }

            if (req.files.additionalImages && req.files.additionalImages.length > 0) {
                for (const file of req.files.additionalImages) {
                    const result = await cloudinary.uploader.upload(file.path, {
                        folder: 'my_marketplace_products/additional',
                    });
                    product.images.push(result.secure_url);
                    fs.unlinkSync(file.path);
                }
            }
        }
        
        product.updatedAt = Date.now();
        await product.save();
        res.redirect(`/products/${product._id}?message=Product updated successfully!`);

    } catch (err) {
        console.error("Error in updateProduct:", err);
        if (req.files) { 
            if (req.files.productImage && req.files.productImage[0]) fs.unlink(req.files.productImage[0].path, () => {});
            if (req.files.additionalImages) req.files.additionalImages.forEach(f => fs.unlink(f.path, () => {}));
        }
        // Load product again for the form if error
        const productForForm = await Product.findById(productId);
        res.status(500).render('products/edit', { 
            title: 'Edit Product - ' + (productForForm ? productForForm.name : 'Error'),
            product: productForForm || req.body, // Kirim data lama atau inputan baru
            message: { type: 'error', text: 'Error updating product. ' + err.message }
        });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (product.seller.toString() !== req.session.userId && req.session.userRole !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden. You do not own this product.' });
        }

        // Hapus gambar dari Cloudinary (ini bagian penting dan kompleks)
        // Anda perlu menyimpan public_id dari Cloudinary saat upload untuk bisa menghapusnya.
        // Contoh (jika public_id disimpan):
        // if (product.imageUrlPublicId) await cloudinary.uploader.destroy(product.imageUrlPublicId);
        // for (const imgPublicId of product.imagesPublicIds) {
        //     await cloudinary.uploader.destroy(imgPublicId);
        // }
        
        await Product.deleteOne({ _id: req.params.id });

        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
             return res.json({ success: true, message: 'Product deleted successfully' });
        } else {
            res.redirect('/user/my-products?message=Product deleted successfully');
        }

    } catch (err) {
        console.error("Error in deleteProduct:", err);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({ success: false, message: 'Error deleting product: ' + err.message });
        } else {
            res.status(500).render('500', { title: 'Server Error', error: err });
        }
    }
};