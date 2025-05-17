const express = require('express');
const router = express.Router();
const { Notification } = require('../models/alert');
const notificationService = require('../services/notificationService');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get list of notifications
 *     tags: [Notifications]
 *     description: Retrieve a list of notifications with optional filtering
 *     parameters:
 *       - in: query
 *         name: alertId
 *         schema:
 *           type: string
 *         description: Filter by alert ID
 *       - in: query
 *         name: patientId
 *         schema:
 *           type: string
 *         description: Filter by patient ID
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *         description: Filter by notification channel
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by notification status
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start timestamp (ISO format)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End timestamp (ISO format)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of items to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of items to skip
 *     responses:
 *       200:
 *         description: List of notifications
 *       500:
 *         description: Server error
 */
router.get('/', async (req, res) => {
  try {
    const { alertId, patientId, channel, status, recipient, from, to, limit: limitStr, offset: offsetStr } = req.query;
    const limit = parseInt(limitStr) || 20;
    const offset = parseInt(offsetStr) || 0;
    
    // Build query
    const query = {};
    
    if (alertId) query.alertId = alertId;
    if (patientId) query.patientId = patientId;
    if (channel) query.channel = channel;
    if (status) query.status = status;
    if (recipient) query.recipient = recipient;
    
    // Add date range if specified
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }
    
    // Get total count
    const total = await Notification.countDocuments(query);
    
    // Get paginated results
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);
    
    res.status(200).json({
      success: true,
      total,
      count: notifications.length,
      data: notifications
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/notifications/{notificationId}:
 *   get:
 *     summary: Get notification by ID
 *     tags: [Notifications]
 *     description: Retrieve a specific notification by its ID
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification details
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Server error
 */
router.get('/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const notification = await Notification.findOne({ notificationId });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    logger.error(`Error fetching notification ${req.params.notificationId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/notifications/resend/{notificationId}:
 *   post:
 *     summary: Resend a notification
 *     tags: [Notifications]
 *     description: Resend a failed or pending notification
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification resent successfully
 *       404:
 *         description: Notification not found
 *       400:
 *         description: Cannot resend notification in current state
 *       500:
 *         description: Server error
 */
router.post('/resend/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const notification = await Notification.findOne({ notificationId });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    // Only resend failed or pending notifications
    if (notification.status !== 'FAILED' && notification.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot resend notification with status ${notification.status}`
      });
    }
    
    // Prepare notification data for resending
    const resendData = {
      alertId: notification.alertId,
      patientId: notification.patientId,
      channel: notification.channel,
      recipient: notification.recipient,
      recipientName: notification.recipientName,
      content: notification.content
    };
    
    // Send the notification
    const resent = await notificationService.sendNotification(resendData);
    
    res.status(200).json({
      success: true,
      message: 'Notification resent successfully',
      data: resent
    });
  } catch (error) {
    logger.error(`Error resending notification ${req.params.notificationId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend notification',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/notifications/alert/{alertId}:
 *   get:
 *     summary: Get notifications for an alert
 *     tags: [Notifications]
 *     description: Retrieve all notifications sent for a specific alert
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: List of notifications for the alert
 *       500:
 *         description: Server error
 */
router.get('/alert/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;
    
    const notifications = await Notification.find({ alertId })
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications
    });
  } catch (error) {
    logger.error(`Error fetching notifications for alert ${req.params.alertId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/notifications/stats:
 *   get:
 *     summary: Get notification statistics
 *     tags: [Notifications]
 *     description: Get summary statistics about notifications
 *     responses:
 *       200:
 *         description: Notification statistics
 *       500:
 *         description: Server error
 */
router.get('/stats', async (req, res) => {
  try {
    // Get count of notifications by status
    const statusCounts = await Notification.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Get count of notifications by channel
    const channelCounts = await Notification.aggregate([
      { $group: { _id: '$channel', count: { $sum: 1 } } }
    ]);
    
    // Format the results
    const formatResults = (aggregation) => {
      const result = {};
      aggregation.forEach(item => {
        result[item._id] = item.count;
      });
      return result;
    };
    
    // Get count of notifications in the last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const last24HoursCount = await Notification.countDocuments({
      createdAt: { $gte: oneDayAgo }
    });
    
    res.status(200).json({
      success: true,
      stats: {
        byStatus: formatResults(statusCounts),
        byChannel: formatResults(channelCounts),
        last24Hours: last24HoursCount
      }
    });
  } catch (error) {
    logger.error('Error fetching notification statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification statistics',
      error: error.message
    });
  }
});

module.exports = router;