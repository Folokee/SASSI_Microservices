const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const os = require('os');
const { Alert, Notification } = require('../models/alert');
const { logger } = require('../utils/logger');

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
    const newAlerts = await Alert.countDocuments({ status: 'NEW' });
    const lastAlert = await Alert.findOne().sort({ createdAt: -1 });
    const lastAlertTime = lastAlert ? lastAlert.createdAt : null;
    
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
      alertStats: {
        newAlerts,
        lastAlertTime
      },
      timestamp: new Date()
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
 * /api/health/notification-services:
 *   get:
 *     summary: Check notification services health
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Notification services health status
 *       500:
 *         description: Service error
 */
router.get('/notification-services', async (req, res) => {
  try {
    // Get notification status statistics
    const failedCount = await Notification.countDocuments({ status: 'FAILED' });
    const pendingCount = await Notification.countDocuments({ status: 'PENDING' });
    const deliveredCount = await Notification.countDocuments({ status: 'DELIVERED' });
    const sentCount = await Notification.countDocuments({ status: 'SENT' });
    
    // Get recent failed notifications
    const recentFailures = await Notification.find({ status: 'FAILED' })
      .sort({ createdAt: -1 })
      .limit(5);
    
    // Determine health status
    const isHealthy = failedCount < 10; // Arbitrary threshold
    
    // Get notification channel statistics
    const channelStats = await Notification.aggregate([
      { 
        $group: { 
          _id: { 
            channel: '$channel', 
            status: '$status' 
          }, 
          count: { $sum: 1 } 
        } 
      }
    ]);
    
    // Format channel statistics
    const channels = {};
    channelStats.forEach(stat => {
      if (!channels[stat._id.channel]) {
        channels[stat._id.channel] = {};
      }
      channels[stat._id.channel][stat._id.status] = stat.count;
    });
    
    res.status(isHealthy ? 200 : 500).json({
      status: isHealthy ? 'healthy' : 'degraded',
      statistics: {
        failed: failedCount,
        pending: pendingCount,
        delivered: deliveredCount,
        sent: sentCount,
        total: failedCount + pendingCount + deliveredCount + sentCount
      },
      channels,
      recentFailures: recentFailures.map(failure => ({
        notificationId: failure.notificationId,
        channel: failure.channel,
        recipient: failure.recipient,
        errorMessage: failure.errorMessage,
        timestamp: failure.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check notification services health',
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
    
    const hourlyAlertStats = await Alert.aggregate([
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
    
    const hourlyNotificationStats = await Notification.aggregate([
      { 
        $match: { 
          createdAt: { $gte: yesterday, $lte: now } 
        } 
      },
      {
        $group: {
          _id: { 
            $dateToString: { format: "%Y-%m-%d %H:00", date: "$createdAt" } 
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Format the results
    const hourlyAlerts = {};
    hourlyAlertStats.forEach(item => {
      hourlyAlerts[item._id] = item.count;
    });
    
    const hourlyNotifications = {};
    hourlyNotificationStats.forEach(item => {
      hourlyNotifications[item._id] = item.count;
    });
    
    // Get current load (last minute)
    const oneMinuteAgo = new Date(now);
    oneMinuteAgo.setMinutes(oneMinuteAgo.getMinutes() - 1);
    
    const currentAlertLoad = await Alert.countDocuments({
      timestamp: { $gte: oneMinuteAgo }
    });
    
    const currentNotificationLoad = await Notification.countDocuments({
      createdAt: { $gte: oneMinuteAgo }
    });
    
    res.status(200).json({
      success: true,
      currentLoad: {
        alerts: {
          lastMinute: currentAlertLoad
        },
        notifications: {
          lastMinute: currentNotificationLoad
        }
      },
      hourlyLoad: {
        alerts: hourlyAlerts,
        notifications: hourlyNotifications
      }
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