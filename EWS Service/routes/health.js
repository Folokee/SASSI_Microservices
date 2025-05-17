const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const os = require('os');
const { EWSScoreEvent, EWSConsensus } = require('../models/ews');

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Check service health
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *       500:
 *         description: Service is unhealthy
 */
router.get('/', async (req, res) => {
  try {
    // Check database connection
    const dbState = mongoose.connection.readyState;
    const dbConnected = dbState === 1; // 1 = connected
    
    // Get some system metrics
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const freeMemory = os.freemem();
    const totalMemory = os.totalmem();
    
    // Get some basic service stats
    const lastEvent = await EWSScoreEvent.findOne().sort({ createdAt: -1 });
    const lastEventTime = lastEvent ? lastEvent.createdAt : null;
    
    if (!dbConnected) {
      return res.status(500).json({
        status: 'unhealthy',
        dbConnected: false,
        message: 'Database connection is not established'
      });
    }
    
    res.status(200).json({
      status: 'healthy',
      uptime: uptime,
      dbConnected: dbConnected,
      memory: {
        free: freeMemory,
        total: totalMemory,
        usage: Math.round((memoryUsage.rss / totalMemory) * 100)
      },
      lastEventTime: lastEventTime
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/health/consensus:
 *   get:
 *     summary: Get consensus health metrics
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Consensus health information
 *       500:
 *         description: Service error
 */
router.get('/consensus', async (req, res) => {
  try {
    // Get total count
    const totalCount = await EWSConsensus.countDocuments();
    
    // Get valid consensus count
    const validCount = await EWSConsensus.countDocuments({ validConsensus: true });
    
    // Get stats by consensus method
    const consensusByMethod = await EWSConsensus.aggregate([
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
    
    // Get recent invalid consensus events
    const recentInvalidEvents = await EWSConsensus.find({ validConsensus: false })
      .sort({ consensusTimestamp: -1 })
      .limit(5);
    
    res.status(200).json({
      success: true,
      totalConsensusEvents: totalCount,
      validConsensusEvents: validCount,
      invalidConsensusEvents: totalCount - validCount,
      consensusByMethod: methodStats,
      recentInvalidEvents: recentInvalidEvents.map(event => ({
        consensusId: event.consensusId,
        patientId: event.patientId,
        timestamp: event.consensusTimestamp,
        nodeCount: event.nodeScores.length
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch consensus health metrics',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/health/load:
 *   get:
 *     summary: Get service load metrics
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service load metrics
 *       500:
 *         description: Service error
 */
router.get('/load', async (req, res) => {
  try {
    // Get counts by hour for the last 24 hours
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const hourlyStats = await EWSScoreEvent.aggregate([
      { 
        $match: { 
          timestamp: { $gte: yesterday, $lte: now } 
        } 
      },
      {
        $group: {
          _id: { 
            $dateToString: { format: "%Y-%m-%d %H:00", date: "$timestamp" } 
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Format the results
    const hourlyData = {};
    hourlyStats.forEach(item => {
      hourlyData[item._id] = item.count;
    });
    
    // Get current load (last minute)
    const oneMinuteAgo = new Date(now);
    oneMinuteAgo.setMinutes(oneMinuteAgo.getMinutes() - 1);
    
    const currentLoad = await EWSScoreEvent.countDocuments({
      timestamp: { $gte: oneMinuteAgo }
    });
    
    res.status(200).json({
      success: true,
      currentLoad: {
        lastMinute: currentLoad
      },
      hourlyLoad: hourlyData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch load metrics',
      error: error.message
    });
  }
});

module.exports = router;