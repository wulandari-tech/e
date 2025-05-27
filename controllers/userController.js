const User = require('../models/user');
const Product = require('../models/product');
const bcrypt = require('bcryptjs');
const cloudinary = require('../config/cloudinary');
const fs = require('fs').promises; 
const path = require('path');

const deleteTempFile = async (filePath) => {
    if (filePath) {
        try {
            await fs.unlink(filePath);
        } catch (e) {
            console.error("Error deleting temp file:", filePath, e);
        }
    }
};

exports.getSellerDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('-password');
    if (!user) {
      return res.redirect('/auth/login?message=User not found. Please login again.');
    }
    const products = await Product.find({ seller: req.session.userId }).countDocuments();
    const pendingProducts = await Product.find({ seller: req.session.userId, status: 'pending' }).countDocuments();
    
    res.render('user/dashboard', { 
        title: 'Seller Dashboard', 
        user, 
        totalProducts: products,
        pendingProducts,
        message: req.query.message ? { type: req.query.type || 'info', text: req.query.message } : null
    });
  } catch (err) {
    console.error("Error in getSellerDashboard:", err);
    res.status(500).render('500', { title: 'Server Error', error: err });
  }
};

exports.getMyProducts = async (req, res) => {
  try {
    const products = await Product.find({ seller: req.session.userId }).sort({ createdAt: -1 });
    res.render('user/my_products', { 
        title: 'My Products', 
        products, 
        message: req.query.message ? { type: req.query.type || 'info', text: req.query.message } : null
    });
  } catch (err) {
    console.error("Error in getMyProducts:", err);
    res.status(500).render('500', { title: 'Server Error', error: err });
  }
};

exports.getProfilePage = async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).select('-password');
        if (!user) {
            return res.redirect('/auth/login?message=Please login to view your profile.');
        }
        res.render('user/profile', {
            title: 'My Profile - ' + user.username,
            currentUser: user, // Kirim user yang fresh dari DB
            message: req.query.message ? { type: req.query.type || 'info', text: req.query.message } : null
        });
    } catch (err) {
        console.error("Error getting profile page:", err);
        res.status(500).render('500', { title: 'Server Error', error: err });
    }
};

exports.updateProfileDetails = async (req, res) => {
    const { username, email, whatsappNumber } = req.body;
    const userId = req.session.userId;

    try {
        const userToUpdate = await User.findById(userId);
        if (!userToUpdate) {
            return res.redirect('/auth/login?message=User not found. Please login again.');
        }

        if (email && email !== userToUpdate.email) {
            const existingUserWithEmail = await User.findOne({ email: email, _id: { $ne: userId } });
            if (existingUserWithEmail) {
                return res.redirect(`/user/profile?type=error&message=Email '${email}' is already in use.#profile-details`);
            }
            userToUpdate.email = email;
        }
        if (username && username !== userToUpdate.username) {
            const existingUserWithUsername = await User.findOne({ username: username, _id: { $ne: userId } });
            if (existingUserWithUsername) {
                return res.redirect(`/user/profile?type=error&message=Username '${username}' is already taken.#profile-details`);
            }
            userToUpdate.username = username;
        }

        if (userToUpdate.role === 'seller') {
            userToUpdate.whatsappNumber = whatsappNumber !== undefined ? whatsappNumber.trim() : userToUpdate.whatsappNumber;
        }

        await userToUpdate.save();
        
        // Perbarui juga currentUser di res.locals agar tampilan header langsung update
        res.locals.currentUser = await User.findById(userId).select('-password'); // Ambil data terbaru

        res.redirect('/user/profile?type=success&message=Profile details updated successfully!#profile-details');

    } catch (err) {
        console.error("Error updating profile details:", err);
        let errorMessage = 'Error updating profile. ' + (err.message || '');
        if (err.code === 11000) { 
            const field = Object.keys(err.keyValue)[0];
            errorMessage = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`;
        }
        res.redirect(`/user/profile?type=error&message=${encodeURIComponent(errorMessage)}#profile-details`);
    }
};

exports.updatePassword = async (req, res) => {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const userId = req.session.userId;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        return res.redirect('/user/profile?type=error&message=All password fields are required.#change-password');
    }
    if (newPassword !== confirmNewPassword) {
        return res.redirect('/user/profile?type=error&message=New passwords do not match.#change-password');
    }
    if (newPassword.length < 6) {
        return res.redirect('/user/profile?type=error&message=New password must be at least 6 characters long.#change-password');
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.redirect('/auth/login?message=User not found. Please login again.');
        }

        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.redirect('/user/profile?type=error&message=Incorrect current password.#change-password');
        }

        user.password = newPassword; 
        await user.save();

        res.redirect('/user/profile?type=success&message=Password updated successfully!#change-password');

    } catch (err) {
        console.error("Error updating password:", err);
        res.redirect(`/user/profile?type=error&message=${encodeURIComponent('Error updating password: ' + err.message)}#change-password`);
    }
};

exports.updateAvatar = async (req, res) => {
    const userId = req.session.userId;
    
    if (!req.file) {
        return res.redirect('/user/profile?type=error&message=No avatar image file selected.#profile-details');
    }

    const tempFilePath = req.file.path;

    try {
        const user = await User.findById(userId);
        if (!user) {
            await deleteTempFile(tempFilePath);
            return res.redirect('/auth/login?message=User not found. Please login again.');
        }
        
        // Hapus avatar lama dari Cloudinary jika ada dan bukan default, dan jika public_id disimpan
        if (user.avatarCloudinaryPublicId && user.avatarUrl !== '/img/default-avatar.png') {
            try {
                await cloudinary.uploader.destroy(user.avatarCloudinaryPublicId);
            } catch (cloudinaryError) {
                console.error("Cloudinary old avatar delete error:", cloudinaryError);
                // Lanjutkan proses meskipun gagal hapus, mungkin log errornya
            }
        }
        
        const result = await cloudinary.uploader.upload(tempFilePath, {
            folder: 'my_marketplace_avatars',
            public_id: `avatar_${userId}_${Date.now()}`, 
            transformation: [{ width: 250, height: 250, crop: "fill", gravity: "face", quality: "auto:good" }]
        });

        await deleteTempFile(tempFilePath);

        user.avatarUrl = result.secure_url;
        user.avatarCloudinaryPublicId = result.public_id; // Simpan public_id untuk penghapusan di masa depan
        await user.save();
        
        res.locals.currentUser = await User.findById(userId).select('-password'); // Update currentUser di locals

        res.redirect('/user/profile?type=success&message=Avatar updated successfully!#profile-details');

    } catch (err) {
        console.error("Error updating avatar:", err);
        await deleteTempFile(tempFilePath);
        res.redirect(`/user/profile?type=error&message=${encodeURIComponent('Error updating avatar: ' + err.message)}#profile-details`);
    }
};