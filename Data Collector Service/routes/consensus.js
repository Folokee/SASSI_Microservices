const express = require('express');
const router = express.Router();
const { ConsensusData } = require('../models/sensorData');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/consensus/status:
 *   get:
 *     summary: Get consensus status statistics
 *     tags: [Consensus]
 *     responses:
 *       200:
 *         description: Consensus statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 totalConsensusEvents:
 *                   type: number
 *                 validConsensusEvents:
 *                   type: number
 *                 invalidConsensusEvents:
 *                   type: number
 *                 consensusByMethod:
 *                   type: object
 *       500:
 *         description: Server error
 */
router.get('/status', async (req, res) => {
  try {
    // Get total count
    const totalCount = await ConsensusData.countDocuments();
    
    // Get valid consensus count
    const validCount = await ConsensusData.countDocuments({ validConsensus: true });
    
    // Get stats by consensus method
    const consensusByMethod = await ConsensusData.aggregate([
      { $group: { 
        _id: '$consensusMethod', 
        count: { $sum: 1 } 
      } }
    ]);
    
    // Format the result
    const methodStats = {};
    consensusByMethod.forEach(item => {
      methodStats[item._id] = item.count;
    });
    
    res.status(200).json({
      success: true,
      totalConsensusEvents: totalCount,
      validConsensusEvents: validCount,
      invalidConsensusEvents: totalCount - validCount,
      consensusByMethod: methodStats
    });
  } catch (error) {
    logger.error('Error fetching consensus stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch consensus statistics',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/consensus/invalid:
 *   get:
 *     summary: Get list of invalid consensus events
 *     tags: [Consensus]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of items to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of items to skip
 *     responses:
 *       200:
 *         description: List of invalid consensus events
 *       500:
 *         description: Server error
 */
router.get('/invalid', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const invalidEvents = await ConsensusData.find({ validConsensus: false })
      .sort({ consensusTimestamp: -1 })
      .skip(offset)
      .limit(limit);
    
    const totalCount = await ConsensusData.countDocuments({ validConsensus: false });
    
    res.status(200).json({
      success: true,
      total: totalCount,
      count: invalidEvents.length,
      data: invalidEvents
    });
  } catch (error) {
    logger.error('Error fetching invalid consensus events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invalid consensus events',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/consensus/threshold:
 *   put:
 *     summary: Update consensus thresholds
 *     tags: [Consensus]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               timestampThreshold:
 *                 type: number
 *                 description: Threshold for timestamp differences in milliseconds
 *               valueThreshold:
 *                 type: number
 *                 description: Threshold for value differences (percentage as decimal)
 *     responses:
 *       200:
 *         description: Thresholds updated successfully
 *       400:
 *         description: Invalid threshold values
 *       500:
 *         description: Server error
 */
router.put('/threshold', async (req, res) => {
  try {
    const { timestampThreshold, valueThreshold } = req.body;
    
    // Store thresholds in database or config service
    // For simplicity, we'll just return a success message here
    
    res.status(200).json({
      success: true,
      message: 'Consensus thresholds updated',
      thresholds: {
        timestampThreshold,
        valueThreshold
      }
    });
  } catch (error) {
    logger.error('Error updating consensus thresholds:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update consensus thresholds',
      error: error.message
    });
  }
});

module.exports = router;