const mongoose = require('mongoose');
const RewardProduct = require('../models/RewardProduct');
const RedemptionRequest = require('../models/RedemptionRequest');
const PointsTransaction = require('../models/PointsTransaction');
const { User } = require('../models/User');

exports.listProducts = async (req, res) => {
  try {
    const products = await RewardProduct.find({ active: true }).lean();
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.listProductsAdmin = async (req, res) => {
  try {
    const products = await RewardProduct.find({}).sort({ createdAt: -1 }).lean();
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { title, description, cost, stock, requiresApproval, metadata } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' });
    }
    if (typeof cost !== 'number' || cost < 0) {
      return res.status(400).json({ error: 'cost must be a non-negative number' });
    }
    const prod = await RewardProduct.create({ title, description, cost, stock: stock || 0, requiresApproval: !!requiresApproval, metadata, createdBy: req.user?.id });
    res.status(201).json(prod);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    if (req.body.cost !== undefined && (typeof req.body.cost !== 'number' || req.body.cost < 0)) {
      return res.status(400).json({ error: 'cost must be a non-negative number' });
    }
    if (req.body.stock !== undefined && (typeof req.body.stock !== 'number' || req.body.stock < 0)) {
      return res.status(400).json({ error: 'stock must be a non-negative number' });
    }
    const prod = await RewardProduct.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!prod) return res.status(404).json({ error: 'Product not found' });
    res.json(prod);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const deleted = await RewardProduct.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Product not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Create a redemption request (user spends points)
exports.createRedemption = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { productId, metadata } = req.body;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const user = await User.findById(userId).session(session);
      const product = await RewardProduct.findById(productId).session(session);
      if (!product || !product.active) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ error: 'Product not found' });
      }

      if ((user.pointsBalance || 0) < product.cost) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'Insufficient points' });
      }

      user.pointsBalance = (user.pointsBalance || 0) - Number(product.cost);
      await user.save({ session });

      await PointsTransaction.create([{ user: userId, amount: -Number(product.cost), type: 'redemption', meta: { productId } }], { session });

      const reqObj = await RedemptionRequest.create([{ user: userId, product: productId, cost: product.cost, status: product.requiresApproval ? 'pending' : 'approved', metadata }], { session });

      await session.commitTransaction();
      session.endSession();

      res.status(201).json({ ok: true, request: reqObj[0], balance: user.pointsBalance });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Admin: list redemptions
exports.listRedemptions = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const items = await RedemptionRequest.find(filter).populate('user').populate('product').sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Admin: approve or reject
exports.updateRedemption = async (req, res) => {
  try {
    const { action } = req.body; // 'approve' | 'reject' | 'complete'
    const id = req.params.id;

    const item = await RedemptionRequest.findById(id);
    if (!item) return res.status(404).json({ error: 'Not found' });

    if (action === 'approve') {
      item.status = 'approved';
      await item.save();
      return res.json(item);
    }

    if (action === 'reject') {
      // Use transaction to update redemption and refund safely
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        item.status = 'rejected';
        await item.save({ session });

        // refund points
        const user = await User.findById(item.user).session(session);
        user.pointsBalance = (user.pointsBalance || 0) + Number(item.cost);
        await user.save({ session });
        await PointsTransaction.create([{ user: user._id, amount: Number(item.cost), type: 'redemption-refund', meta: { redemptionId: item._id } }], { session });

        await session.commitTransaction();
        session.endSession();
        return res.json(item);
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
      }
    }

    if (action === 'complete') {
      item.status = 'completed';
      await item.save();
      return res.json(item);
    }

    res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
