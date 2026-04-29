const express = require('express');
const router = express.Router();
const rewardsController = require('../controllers/rewardsController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/products', rewardsController.listProducts);
router.get('/products/admin', verifyToken, isAdmin, rewardsController.listProductsAdmin);
router.post('/products', verifyToken, isAdmin, rewardsController.createProduct);
router.put('/products/:id', verifyToken, isAdmin, rewardsController.updateProduct);
router.delete('/products/:id', verifyToken, isAdmin, rewardsController.deleteProduct);

router.post('/redemptions', verifyToken, rewardsController.createRedemption);
router.get('/redemptions', verifyToken, isAdmin, rewardsController.listRedemptions);
router.patch('/redemptions/:id', verifyToken, isAdmin, rewardsController.updateRedemption);

module.exports = router;
