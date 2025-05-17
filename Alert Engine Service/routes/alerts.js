const express = require('express');
const router = express.Router();
const { Alert } = require('../models/alert');
const alertProcessor = require('../services/alertProcessor');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/alerts:
 *   post:
 *     summary: Create a new alert
 *     tags: [Alerts]
 *     description: Create a new medical alert and process it
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - patientId
 *               - alertType
 *               - alertSeverity
 *               - message
 *             properties:
 *               patientId:
 *                 type: string
 *                 description: The ID of the patient
 *               sourceService:
 *                 type: string
 *                 description: The service that generated the alert
 *               alertType:
 *                 type: string
 *                 description: Type of alert (e.g., EWS_CRITICAL)
 *               alertSeverity:
 *                 type: string
 *                 enum: [HIGH, MEDIUM, LOW]
 *                 description: Severity level of the alert
 *               message:
 *                 type: string
 *                 description: Alert message
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: The time when the alert was generated
 *               sensorData:
 *                 type: object
 *                 description: Sensor data that triggered the alert
 *               ewsData:
 *                 type: object
 *                 description: EWS data that triggered the alert
 *     responses:
 *       201:
 *         description: Alert created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 alert:
 *                   $ref: '#/components/schemas/Alert'
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 */
router.post('/', async (req, res) => {
  try {
    const { patientId, sourceService, alertType, alertSeverity, message, timestamp, sensorData, ewsData } = req.body;
    
    // Validate required fields
    if (!patientId || !alertType || !alertSeverity || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: patientId, alertType, alertSeverity, and message are required'
      });
    }
    
    // Validate alertSeverity
    if (!['HIGH', 'MEDIUM', 'LOW'].includes(alertSeverity)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid alertSeverity. Must be one of: HIGH, MEDIUM, LOW'
      });
    }
    
    // Create alert data
    const alertData = {
      patientId,
      sourceService,
      alertType,
      alertSeverity,
      message,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      sensorData,
      ewsData
    };
    
    // Process the alert
    const alert = await alertProcessor.processAlert(alertData);
    
    // Return success response
    res.status(201).json({
      success: true,
      alert
    });
  } catch (error) {
    logger.error('Error creating alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create alert',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/alerts:
 *   get:
 *     summary: Get list of alerts
 *     tags: [Alerts]
 *     description: Retrieve a list of alerts with optional filtering
 *     parameters:
 *       - in: query
 *         name: patientId
 *         schema:
 *           type: string
 *         description: Filter by patient ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by alert status
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *         description: Filter by alert severity
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
 *         description: List of alerts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 total:
 *                   type: integer
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Alert'
 *       500:
 *         description: Server error
 */
router.get('/', async (req, res) => {
  try {
    const { patientId, status, severity, from, to, limit: limitStr, offset: offsetStr } = req.query;
    const limit = parseInt(limitStr) || 20;
    const offset = parseInt(offsetStr) || 0;
    
    // Build query
    const query = {};
    
    if (patientId) query.patientId = patientId;
    if (status) query.status = status;
    if (severity) query.alertSeverity = severity;
    
    // Add date range if specified
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to);
    }
    
    // Get total count
    const total = await Alert.countDocuments(query);
    
    // Get paginated results
    const alerts = await Alert.find(query)
      .sort({ priority: -1, timestamp: -1 })
      .skip(offset)
      .limit(limit);
    
    res.status(200).json({
      success: true,
      total,
      count: alerts.length,
      data: alerts
    });
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alerts',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/alerts/{alertId}:
 *   get:
 *     summary: Get alert by ID
 *     tags: [Alerts]
 *     description: Retrieve a specific alert by its ID
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Alert details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Alert'
 *       404:
 *         description: Alert not found
 *       500:
 *         description: Server error
 */
router.get('/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;
    
    const alert = await Alert.findOne({ alertId });
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: alert
    });
  } catch (error) {
    logger.error(`Error fetching alert ${req.params.alertId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alert',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/alerts/{alertId}/acknowledge:
 *   put:
 *     summary: Acknowledge an alert
 *     tags: [Alerts]
 *     description: Mark an alert as acknowledged
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the user acknowledging the alert
 *     responses:
 *       200:
 *         description: Alert acknowledged successfully
 *       404:
 *         description: Alert not found
 *       500:
 *         description: Server error
 */
router.put('/:alertId/acknowledge', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }
    
    const alert = await alertProcessor.acknowledgeAlert(alertId, userId);
    
    res.status(200).json({
      success: true,
      message: 'Alert acknowledged successfully',
      data: alert
    });
  } catch (error) {
    logger.error(`Error acknowledging alert ${req.params.alertId}:`, error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge alert',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/alerts/{alertId}/resolve:
 *   put:
 *     summary: Resolve an alert
 *     tags: [Alerts]
 *     description: Mark an alert as resolved
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the user resolving the alert
 *               resolution:
 *                 type: string
 *                 description: Optional resolution notes
 *     responses:
 *       200:
 *         description: Alert resolved successfully
 *       404:
 *         description: Alert not found
 *       500:
 *         description: Server error
 */
router.put('/:alertId/resolve', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { userId, resolution } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }
    
    const alert = await alertProcessor.resolveAlert(alertId, userId, resolution);
    
    res.status(200).json({
      success: true,
      message: 'Alert resolved successfully',
      data: alert
    });
  } catch (error) {
    logger.error(`Error resolving alert ${req.params.alertId}:`, error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to resolve alert',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/alerts/{alertId}/escalate:
 *   put:
 *     summary: Escalate an alert
 *     tags: [Alerts]
 *     description: Escalate an alert for higher-level attention
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for escalation
 *     responses:
 *       200:
 *         description: Alert escalated successfully
 *       404:
 *         description: Alert not found
 *       500:
 *         description: Server error
 */
router.put('/:alertId/escalate', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { reason } = req.body;
    
    const alert = await alertProcessor.escalateAlert(alertId, reason);
    
    res.status(200).json({
      success: true,
      message: 'Alert escalated successfully',
      data: alert
    });
  } catch (error) {
    logger.error(`Error escalating alert ${req.params.alertId}:`, error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to escalate alert',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/alerts/patient/{patientId}/recent:
 *   get:
 *     summary: Get recent alerts for a patient
 *     tags: [Alerts]
 *     description: Get the most recent alerts for a specific patient
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of alerts to return
 *     responses:
 *       200:
 *         description: List of recent patient alerts
 *       500:
 *         description: Server error
 */
router.get('/patient/:patientId/recent', async (req, res) => {
  try {
    const { patientId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    
    const alerts = await Alert.find({ patientId })
      .sort({ timestamp: -1 })
      .limit(limit);
    
    res.status(200).json({
      success: true,
      count: alerts.length,
      data: alerts
    });
  } catch (error) {
    logger.error(`Error fetching recent alerts for patient ${req.params.patientId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent alerts',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/alerts/summary:
 *   get:
 *     summary: Get alerts summary
 *     tags: [Alerts]
 *     description: Get summary statistics about alerts
 *     responses:
 *       200:
 *         description: Alert summary statistics
 *       500:
 *         description: Server error
 */
router.get('/summary', async (req, res) => {
  try {
    // Get count of alerts by status
    const statusCounts = await Alert.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Get count of alerts by severity
    const severityCounts = await Alert.aggregate([
      { $group: { _id: '$alertSeverity', count: { $sum: 1 } } }
    ]);
    
    // Get count of alerts by type
    const typeCounts = await Alert.aggregate([
      { $group: { _id: '$alertType', count: { $sum: 1 } } }
    ]);
    
    // Format the results
    const formatResults = (aggregation) => {
      const result = {};
      aggregation.forEach(item => {
        result[item._id] = item.count;
      });
      return result;
    };
    
    // Get count of alerts in the last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const last24HoursCount = await Alert.countDocuments({
      timestamp: { $gte: oneDayAgo }
    });
    
    // Get hourly alert counts for the last 24 hours
    const hourlyStats = await Alert.aggregate([
      { 
        $match: { 
          timestamp: { $gte: oneDayAgo } 
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
    
    const hourlyData = {};
    hourlyStats.forEach(item => {
      hourlyData[item._id] = item.count;
    });
    
    res.status(200).json({
      success: true,
      summary: {
        byStatus: formatResults(statusCounts),
        bySeverity: formatResults(severityCounts),
        byType: formatResults(typeCounts),
        last24Hours: {
          total: last24HoursCount,
          hourly: hourlyData
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching alert summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alert summary',
      error: error.message
    });
  }
});

module.exports = router;