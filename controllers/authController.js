const User = require('../models/user');
const bcrypt = require('bcryptjs');

exports.getRegister = (req, res) => {
  res.render('auth/register', { title: 'Register', message: null });
};

exports.postRegister = async (req, res) => {
  const { username, email, password, confirmPassword, role, whatsappNumber } = req.body;

  if (password !== confirmPassword) {
    return res.render('auth/register', { title: 'Register', message: 'Passwords do not match' });
  }

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.render('auth/register', { title: 'Register', message: 'User already exists' });
    }

    user = new User({
      username,
      email,
      password,
      role: role || 'buyer',
      whatsappNumber: role === 'seller' ? whatsappNumber : undefined,
    });

    await user.save();
    req.session.userId = user._id;
    req.session.userRole = user.role;
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('auth/register', { title: 'Register', message: 'Server error' });
  }
};

exports.getLogin = (req, res) => {
  res.render('auth/login', { title: 'Login', message: null });
};

exports.postLogin = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.render('auth/login', { title: 'Login', message: 'Invalid credentials' });
    }

    if (user.isBanned) {
      return res.render('auth/login', { title: 'Login', message: 'Your account has been banned.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.render('auth/login', { title: 'Login', message: 'Invalid credentials' });
    }

    req.session.userId = user._id;
    req.session.userRole = user.role;
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('auth/login', { title: 'Login', message: 'Server error' });
  }
};

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
    }
    res.redirect('/');
  });
};