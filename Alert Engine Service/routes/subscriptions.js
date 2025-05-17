const express = require('express');
const router = express.Router();
const { AlertSubscription } = require('../models/alert');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/subscriptions:
 *   post:
 *     summary: Create a new alert subscription
 *     tags: [Subscriptions]
 *     description: Create a new subscription for alert notifications
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AlertSubscription'
 *     responses:
 *       201:
 *         description: Subscription created successfully
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 */
router.post('/', async (req, res) => {
  try {
    const { subscriberType, subscriberId, patientId, alertTypes, minSeverity, channels } = req.body;
    
    // Validate required fields
    if (!subscriberType || !subscriberId || !channels || !channels.length) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: subscriberType, subscriberId, and channels are required'
      });
    }
    
    // Check if subscription already exists
    const existingSubscription = await AlertSubscription.findOne({
      subscriberType,
      subscriberId,
      patientId: patientId || null
    });
    
    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: 'A subscription already exists for this subscriber and patient',
        subscriptionId: existingSubscription.subscriptionId
      });
    }
    
    // Validate channels
    const validChannels = channels.every(channel => 
      channel.type && 
      ['EMAIL', 'SMS', 'PUSH', 'IN_APP'].includes(channel.type) && 
      channel.contact
    );
    
    if (!validChannels) {
      return res.status(400).json({
        success: false,
        message: 'Invalid channels. Each channel must have a valid type and contact information'
      });
    }
    
    // Create subscription
    const subscription = new AlertSubscription({
      subscriberType,
      subscriberId,
      patientId,
      alertTypes: alertTypes || [],
      minSeverity: minSeverity || 'MEDIUM',
      channels,
      scheduleEnabled: req.body.scheduleEnabled || false,
      schedule: req.body.schedule || null,
      active: req.body.active !== undefined ? req.body.active : true
    });
    
    await subscription.save();
    
    res.status(201).json({
      success: true,
      subscription
    });
  } catch (error) {
    logger.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create subscription',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/subscriptions:
 *   get:
 *     summary: Get list of subscriptions
 *     tags: [Subscriptions]
 *     description: Retrieve a list of alert subscriptions
 *     parameters:
 *       - in: query
 *         name: subscriberType
 *         schema:
 *           type: string
 *         description: Filter by subscriber type
 *       - in: query
 *         name: subscriberId
 *         schema:
 *           type: string
 *         description: Filter by subscriber ID
 *       - in: query
 *         name: patientId
 *         schema:
 *           type: string
 *         description: Filter by patient ID
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of subscriptions
 *       500:
 *         description: Server error
 */
router.get('/', async (req, res) => {
  try {
    const { subscriberType, subscriberId, patientId, active } = req.query;
    
    // Build query
    const query = {};
    
    if (subscriberType) query.subscriberType = subscriberType;
    if (subscriberId) query.subscriberId = subscriberId;
    if (patientId) query.patientId = patientId;
    if (active !== undefined) query.active = active === 'true';
    
    const subscriptions = await AlertSubscription.find(query);
    
    res.status(200).json({
      success: true,
      count: subscriptions.length,
      data: subscriptions
    });
  } catch (error) {
    logger.error('Error fetching subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscriptions',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/subscriptions/{subscriptionId}:
 *   get:
 *     summary: Get subscription by ID
 *     tags: [Subscriptions]
 *     description: Retrieve a specific subscription by its ID
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID
 *     responses:
 *       200:
 *         description: Subscription details
 *       404:
 *         description: Subscription not found
 *       500:
 *         description: Server error
 */
router.get('/:subscriptionId', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    
    const subscription = await AlertSubscription.findOne({ subscriptionId });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: subscription
    });
  } catch (error) {
    logger.error(`Error fetching subscription ${req.params.subscriptionId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/subscriptions/{subscriptionId}:
 *   put:
 *     summary: Update a subscription
 *     tags: [Subscriptions]
 *     description: Update an existing alert subscription
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AlertSubscription'
 *     responses:
 *       200:
 *         description: Subscription updated successfully
 *       404:
 *         description: Subscription not found
 *       500:
 *         description: Server error
 */
router.put('/:subscriptionId', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    
    // Find subscription
    const subscription = await AlertSubscription.findOne({ subscriptionId });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }
    
    // Update fields
    const updatableFields = [
      'alertTypes', 'minSeverity', 'channels', 
      'scheduleEnabled', 'schedule', 'active'
    ];
    
    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        subscription[field] = req.body[field];
      }
    });
    
    await subscription.save();
    
    res.status(200).json({
      success: true,
      message: 'Subscription updated successfully',
      data: subscription
    });
  } catch (error) {
    logger.error(`Error updating subscription ${req.params.subscriptionId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to update subscription',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/subscriptions/{subscriptionId}:
 *   delete:
 *     summary: Delete a subscription
 *     tags: [Subscriptions]
 *     description: Delete an existing alert subscription
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID
 *     responses:
 *       200:
 *         description: Subscription deleted successfully
 *       404:
 *         description: Subscription not found
 *       500:
 *         description: Server error
 */
router.delete('/:subscriptionId', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    
    const result = await AlertSubscription.deleteOne({ subscriptionId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Subscription deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting subscription ${req.params.subscriptionId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete subscription',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/subscriptions/subscriber/{subscriberType}/{subscriberId}:
 *   get:
 *     summary: Get subscriptions for a subscriber
 *     tags: [Subscriptions]
 *     description: Get all subscriptions for a specific subscriber
 *     parameters:
 *       - in: path
 *         name: subscriberType
 *         required: true
 *         schema:
 *           type: string
 *         description: Type of subscriber (e.g., STAFF, DEPARTMENT)
 *       - in: path
 *         name: subscriberId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subscriber
 *     responses:
 *       200:
 *         description: List of subscriptions for the subscriber
 *       500:
 *         description: Server error
 */
router.get('/subscriber/:subscriberType/:subscriberId', async (req, res) => {
  try {
    const { subscriberType, subscriberId } = req.params;
    
    const subscriptions = await AlertSubscription.find({
      subscriberType,
      subscriberId
    });
    
    res.status(200).json({
      success: true,
      count: subscriptions.length,
      data: subscriptions
    });
  } catch (error) {
    logger.error(`Error fetching subscriptions for subscriber ${req.params.subscriberType}/${req.params.subscriberId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscriptions',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/subscriptions/patient/{patientId}:
 *   get:
 *     summary: Get subscriptions for a patient
 *     tags: [Subscriptions]
 *     description: Get all subscriptions for a specific patient
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *     responses:
 *       200:
 *         description: List of subscriptions for the patient
 *       500:
 *         description: Server error
 */
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const subscriptions = await AlertSubscription.find({
      patientId
    });
    
    res.status(200).json({
      success: true,
      count: subscriptions.length,
      data: subscriptions
    });
  } catch (error) {
    logger.error(`Error fetching subscriptions for patient ${req.params.patientId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscriptions',
      error: error.message
    });
  }
});

module.exports = router;