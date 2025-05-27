const Product = require('../models/product');
const User = require('../models/user');

exports.getAdminDashboard = (req, res) => {
  res.render('admin/dashboard', { title: 'Admin Dashboard', message: null });
};

exports.getProductsForApproval = async (req, res) => {
  try {
    const products = await Product.find({ status: 'pending' }).populate('seller', 'username email');
    res.render('admin/products_approval', { title: 'Products for Approval', products, message: null });
  } catch (err) {
    console.error(err);
    res.render('admin/products_approval', { title: 'Products for Approval', products: [], message: 'Error fetching products' });
  }
};

exports.approveProduct = async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { status: 'approved' });
    // req.flash('success', 'Product approved');
    res.redirect('/admin/products-approval');
  } catch (err) {
    console.error(err);
    // req.flash('error', 'Error approving product');
    res.redirect('/admin/products-approval');
  }
};

exports.rejectProduct = async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { status: 'rejected' });
    // req.flash('success', 'Product rejected');
    res.redirect('/admin/products-approval');
  } catch (err) {
    console.error(err);
    // req.flash('error', 'Error rejecting product');
    res.redirect('/admin/products-approval');
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.session.userId } }); // Jangan tampilkan admin sendiri
    res.render('admin/users', { title: 'Manage Users', users, message: null });
  } catch (err) {
    console.error(err);
    res.render('admin/users', { title: 'Manage Users', users: [], message: 'Error fetching users' });
  }
};

exports.banUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isBanned: true });
    // req.flash('success', 'User banned');
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    // req.flash('error', 'Error banning user');
    res.redirect('/admin/users');
  }
};

exports.unbanUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isBanned: false });
    // req.flash('success', 'User unbanned');
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    // req.flash('error', 'Error unbanning user');
    res.redirect('/admin/users');
  }
};