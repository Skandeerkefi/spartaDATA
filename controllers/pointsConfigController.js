const PointsConfig = require('../models/PointsConfig');

// Default points for all actions
const DEFAULT_POINTS = {
  'tournament-join': 10,
  'tournament-match-win': 25,
  'tournament-win': 500,
  'slot-call-x1600': 300,
  'giveaway-participation': 5,
  'giveaway-win': 200,
  'daily-login': 0,
  'stream-watchtime': 2, // Points per 2 minutes of watchtime
  'stream-level': 25, // Points per level
  'kick-subscribed': 0, // Points awarded when admin marks user as subscribed
};

// Initialize default configs if they don't exist
exports.initializeDefaults = async () => {
  try {
    for (const [actionType, points] of Object.entries(DEFAULT_POINTS)) {
      const exists = await PointsConfig.findOne({ actionType });
      if (!exists) {
        await PointsConfig.create({
          actionType,
          points,
          description: formatDescription(actionType),
        });
      }
    }
  } catch (error) {
    console.error('Error initializing points config:', error);
  }
};

const formatDescription = (actionType) => {
  const descriptions = {
    'tournament-join': 'Points awarded when a player joins a tournament',
    'tournament-match-win': 'Points awarded for winning a match in tournament',
    'tournament-win': 'Points awarded for winning the entire tournament',
    'slot-call-x1600': 'Points awarded for slot call x1600 hit',
    'giveaway-participation': 'Points awarded for joining a giveaway',
    'giveaway-win': 'Points awarded for winning a giveaway',
    'daily-login': 'Points awarded for daily login',
    'stream-watchtime': 'Points awarded per 2 minutes of stream watchtime',
    'stream-level': 'Points awarded per stream level achieved',
    'kick-subscribed': 'Points awarded when admin marks a user as subscribed to the stream',
  };
  return descriptions[actionType] || actionType;
};

// Get all points configurations
exports.getAllConfigs = async (req, res) => {
  try {
    const configs = await PointsConfig.find().sort({ actionType: 1 });
    
    // If no configs exist, initialize them
    if (configs.length === 0) {
      await exports.initializeDefaults();
      const newConfigs = await PointsConfig.find().sort({ actionType: 1 });
      return res.json(newConfigs);
    }
    
    res.json(configs);
  } catch (error) {
    console.error('Get all configs error:', error);
    res.status(500).json({ message: 'Failed to load points configurations' });
  }
};

// Get points for a specific action
exports.getPointsForAction = async (actionType) => {
  try {
    const config = await PointsConfig.findOne({ actionType });
    
    if (!config) {
      // If not found, return default
      return DEFAULT_POINTS[actionType] || 0;
    }
    
    // If disabled, return 0
    if (!config.enabled) {
      return 0;
    }
    
    return config.points;
  } catch (error) {
    console.error('Get points for action error:', error);
    return DEFAULT_POINTS[actionType] || 0;
  }
};

// Update points for an action
exports.updatePoints = async (req, res) => {
  try {
    const { actionType, points, description, enabled } = req.body;
    
    if (!actionType || points === undefined) {
      return res.status(400).json({ message: 'Action type and points are required' });
    }
    
    if (typeof points !== 'number' || points < 0) {
      return res.status(400).json({ message: 'Points must be a non-negative number' });
    }
    
    let config = await PointsConfig.findOne({ actionType });
    
    if (!config) {
      // Create new config if it doesn't exist
      config = await PointsConfig.create({
        actionType,
        points,
        description: description || formatDescription(actionType),
        enabled: enabled !== undefined ? enabled : true,
        updatedBy: req.user.id,
      });
    } else {
      // Update existing config
      config.points = points;
      if (description) config.description = description;
      if (enabled !== undefined) config.enabled = enabled;
      config.updatedBy = req.user.id;
      await config.save();
    }
    
    res.json(config);
  } catch (error) {
    console.error('Update points error:', error);
    res.status(500).json({ message: 'Failed to update points configuration' });
  }
};

// Update multiple configs at once
exports.updateMultipleConfigs = async (req, res) => {
  try {
    const { configs } = req.body; // Array of { actionType, points, enabled, description }
    
    if (!Array.isArray(configs)) {
      return res.status(400).json({ message: 'Configs must be an array' });
    }
    
    const updated = [];
    
    for (const cfg of configs) {
      const { actionType, points, enabled, description } = cfg;
      
      if (!actionType || points === undefined) {
        continue;
      }
      
      if (typeof points !== 'number' || points < 0) {
        continue;
      }
      
      let config = await PointsConfig.findOne({ actionType });
      
      if (!config) {
        config = await PointsConfig.create({
          actionType,
          points,
          description: description || formatDescription(actionType),
          updatedBy: req.user.id,
        });
      } else {
        config.points = points;
        if (description) config.description = description;
        if (enabled !== undefined) config.enabled = enabled;
        config.updatedBy = req.user.id;
        await config.save();
      }
      
      updated.push(config);
    }
    
    res.json(updated);
  } catch (error) {
    console.error('Update multiple configs error:', error);
    res.status(500).json({ message: 'Failed to update points configurations' });
  }
};

// Reset to defaults
exports.resetToDefaults = async (req, res) => {
  try {
    for (const [actionType, points] of Object.entries(DEFAULT_POINTS)) {
      await PointsConfig.findOneAndUpdate(
        { actionType },
        { points, updatedBy: req.user.id },
        { upsert: true }
      );
    }
    
    const configs = await PointsConfig.find().sort({ actionType: 1 });
    res.json(configs);
  } catch (error) {
    console.error('Reset to defaults error:', error);
    res.status(500).json({ message: 'Failed to reset to defaults' });
  }
};

// Get points history/audit log
exports.getConfigHistory = async (req, res) => {
  try {
    const { actionType } = req.query;
    
    let query = {};
    if (actionType) {
      query.actionType = actionType;
    }
    
    const configs = await PointsConfig.find(query)
      .populate('updatedBy', 'kickUsername')
      .sort({ updatedAt: -1 });
    
    res.json(configs);
  } catch (error) {
    console.error('Get config history error:', error);
    res.status(500).json({ message: 'Failed to load config history' });
  }
};
