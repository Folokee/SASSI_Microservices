const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const os = require('os');
const { ConsensusData } = require('../models/sensorData');

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
    const lastConsensusEvent = await ConsensusData.findOne().sort({ createdAt: -1 });
    const lastConsensusTime = lastConsensusEvent ? lastConsensusEvent.createdAt : null;
    
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
      lastConsensusTime: lastConsensusTime
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
 * /api/health/nodes:
 *   get:
 *     summary: Get status of edge nodes
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Node status information
 *       500:
 *         description: Service error
 */
router.get('/nodes', async (req, res) => {
  try {
    // For a real implementation, you would check connectivity with the edge nodes
    // Here we'll just return sample data
    
    const nodeStatus = [
      { nodeId: 'node-1', status: 'online', lastHeartbeat: new Date() },
      { nodeId: 'node-2', status: 'online', lastHeartbeat: new Date() },
      { nodeId: 'node-3', status: 'online', lastHeartbeat: new Date() }
    ];
    
    res.status(200).json({
      success: true,
      nodes: nodeStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve node status',
      error: error.message
    });
  }
});

module.exports = router;