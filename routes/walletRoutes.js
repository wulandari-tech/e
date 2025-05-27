const express = require('express');
const router = express.Router();
const axios = require('axios');
const { isAuthenticated } = require('../middleware/authMiddleware');
const User = require('../models/user');
const Deposit = require('../models/deposit');
const { v4: uuidv4 } = require('uuid'); 
const FOREST_API_KEY = process.env.FOREST_API_KEY;
const FOREST_API_BASE_URL = process.env.FOREST_API_BASE_URL;
router.get('/deposit', isAuthenticated, async (req, res) => {
    try {
        const response = await axios.get(`${FOREST_API_BASE_URL}/deposit/methods?api_key=${FOREST_API_KEY}`);
        if (response.data.status === 'success') {
            const activeMethods = response.data.data.filter(method => method.status === 'active');
            res.render('wallet/deposit_form', {
                title: 'Deposit Funds',
                methods: activeMethods,
                currentUser: req.user,
                message: req.flash('message') 
            });
        } else {
            req.flash('message', { type: 'error', text: 'Could not load payment methods.' });
            res.redirect('/user/profile'); // Or some other appropriate page
        }
    } catch (error) {
        console.error('Error fetching payment methods:', error);
        req.flash('message', { type: 'error', text: 'Error fetching payment methods. Please try again.' });
        res.redirect('/user/profile');
    }
});

// POST to create a deposit request
router.post('/deposit', isAuthenticated, async (req, res) => {
    const { amount, method_code } = req.body;
    const nominal = parseInt(amount);

    if (!method_code || !nominal || nominal <= 0) {
        req.flash('message', { type: 'error', text: 'Invalid amount or payment method.' });
        return res.redirect('/wallet/deposit');
    }

    // Fetch method details to validate min/max and get fees
    let selectedMethodDetails;
    try {
        const methodsResponse = await axios.get(`${FOREST_API_BASE_URL}/deposit/methods?api_key=${FOREST_API_KEY}`);
        if (methodsResponse.data.status === 'success') {
            selectedMethodDetails = methodsResponse.data.data.find(m => m.metode === method_code && m.status === 'active');
        }
        if (!selectedMethodDetails) {
            req.flash('message', { type: 'error', text: 'Selected payment method is not available.' });
            return res.redirect('/wallet/deposit');
        }
        if (nominal < parseInt(selectedMethodDetails.minimum)) {
            req.flash('message', { type: 'error', text: `Minimum deposit for ${selectedMethodDetails.name} is ${selectedMethodDetails.minimum}.` });
            return res.redirect('/wallet/deposit');
        }
        if (nominal > parseInt(selectedMethodDetails.maximum)) {
            req.flash('message', { type: 'error', text: `Maximum deposit for ${selectedMethodDetails.name} is ${selectedMethodDetails.maximum}.` });
            return res.redirect('/wallet/deposit');
        }

    } catch (err) {
        console.error('Error validating payment method details:', err);
        req.flash('message', { type: 'error', text: 'Could not verify payment method. Please try again.' });
        return res.redirect('/wallet/deposit');
    }


    const reffId = `DEP-${req.user._id.toString().slice(-4)}-${Date.now()}-${uuidv4().slice(0,6)}`; // Unique reference ID

    try {
        const createDepositUrl = `${FOREST_API_BASE_URL}/deposit/create`;
        const params = {
            api_key: FOREST_API_KEY,
            reff_id: reffId,
            method: method_code,
            phone_number: req.user.whatsappNumber || '', // Optional
            fee_by_customer: 'false', // As per your example, seller/platform absorbs fee from nominal
            nominal: nominal
        };

        const apiResponse = await axios.get(createDepositUrl, { params });

        if (apiResponse.data.status === 'success' && apiResponse.data.data) {
            const depositData = apiResponse.data.data;
            
            const newDeposit = new Deposit({
                user: req.user._id,
                forestApiId: depositData.id,
                reffId: reffId,
                method: method_code,
                amount: depositData.nominal,
                fee: depositData.fee,
                netAmount: depositData.get_balance, // This is what user gets
                qrImageUrl: depositData.qr_image_url,
                qrImageString: depositData.qr_image_string,
                status: depositData.status, // Should be 'pending'
                expiresAt: depositData.expired_at ? new Date(depositData.expired_at.replace(' ', 'T') + 'Z') : null, // Adjust for proper ISO format if needed
                apiResponse: apiResponse.data 
            });
            await newDeposit.save();

            res.render('wallet/payment_instruction', {
                title: 'Complete Your Payment',
                deposit: newDeposit,
                methodName: selectedMethodDetails.name,
                currentUser: req.user,
                message: { type: 'info', text: 'Please complete your payment using the details below.'}
            });

        } else {
            console.error('ForestAPI deposit creation error:', apiResponse.data.message || 'Unknown API error');
            req.flash('message', { type: 'error', text: `Payment initiation failed: ${apiResponse.data.message || 'Please try again.'}` });
            res.redirect('/wallet/deposit');
        }
    } catch (error) {
        console.error('Error creating deposit:', error.response ? error.response.data : error.message);
        req.flash('message', { type: 'error', text: 'An error occurred while initiating the deposit. Please try again.' });
        res.redirect('/wallet/deposit');
    }
});

// Placeholder for handling payment success (ideally a webhook)
// For now, let's make a route that an admin or user could "manually" hit to simulate success
// THIS IS NOT FOR PRODUCTION. A WEBHOOK IS NEEDED.
router.post('/deposit/:depositId/confirm-payment', isAuthenticated, async (req, res) => {
    // In a real scenario, only admin or a webhook should do this.
    // For demo, if user is owner of deposit, they can "confirm"
    try {
        const deposit = await Deposit.findById(req.params.depositId).populate('user');
        if (!deposit) {
            req.flash('message', { type: 'error', text: 'Deposit not found.' });
            return res.redirect('/user/profile');
        }

        // Basic check: only owner or admin
        if (!(deposit.user._id.equals(req.user._id) || req.user.role === 'admin')) {
             req.flash('message', { type: 'error', text: 'Unauthorized.' });
            return res.redirect('/user/profile');
        }

        if (deposit.status === 'pending' || deposit.status === 'processing') {
            deposit.status = 'success';
            await deposit.save();

            // Update user balance
            const user = await User.findById(deposit.user._id);
            user.balance += deposit.netAmount; // Add the amount user actually gets
            await user.save();
            
            // Update req.user for the current session
            req.user.balance = user.balance;


            req.flash('message', { type: 'success', text: `Deposit of ${deposit.netAmount} successfully processed (simulated). Your new balance is ${user.balance}.` });
        } else if (deposit.status === 'success') {
            req.flash('message', { type: 'info', text: 'This deposit has already been processed.' });
        } else {
            req.flash('message', { type: 'error', text: `This deposit cannot be confirmed (status: ${deposit.status}).` });
        }
        res.redirect('/user/profile'); // Or a transaction history page

    } catch (error) {
        console.error("Error confirming payment:", error);
        req.flash('message', { type: 'error', text: 'Error processing payment confirmation.' });
        res.redirect('/user/profile');
    }
});


// GET user's deposit history
router.get('/transactions', isAuthenticated, async (req, res) => {
    try {
        const deposits = await Deposit.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.render('wallet/transaction_history', {
            title: 'My Transactions',
            deposits,
            currentUser: req.user,
            message: req.flash('message')
        });
    } catch (error) {
        console.error('Error fetching transaction history:', error);
        req.flash('message', { type: 'error', text: 'Could not load transaction history.' });
        res.redirect('/user/profile');
    }
});


module.exports = router;