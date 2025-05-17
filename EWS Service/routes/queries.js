const express = require('express');
const router = express.Router();
const { EWSReadModel, EWSConsensus, EWSScoreEvent } = require('../models/ews');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/query/patient/{patientId}/latest:
 *   get:
 *     summary: Get latest EWS for a patient
 *     tags: [Queries]
 *     description: Get the latest EWS score and vital signs for a specific patient
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *     responses:
 *       200:
 *         description: Latest EWS data for the patient
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EWSReadModel'
 *       404:
 *         description: No data found for the patient
 *       500:
 *         description: Server error
 */
router.get('/patient/:patientId/latest', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    // Get from the read model (optimized for queries)
    const readModel = await EWSReadModel.findOne({ patientId });
    
    if (!readModel) {
      return res.status(404).json({
        success: false,
        message: 'No EWS data found for this patient'
      });
    }
    
    res.status(200).json({
      success: true,
      data: readModel
    });
  } catch (error) {
    logger.error('Error fetching latest patient EWS:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch patient data',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/query/patient/{patientId}/history:
 *   get:
 *     summary: Get EWS history for a patient
 *     tags: [Queries]
 *     description: Get the historical EWS scores for a specific patient
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
 *           default: 20
 *         description: Maximum number of items to return
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
 *     responses:
 *       200:
 *         description: EWS history for the patient
 *       404:
 *         description: No data found for the patient
 *       500:
 *         description: Server error
 */
router.get('/patient/:patientId/history', async (req, res) => {
  try {
    const { patientId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const { from, to } = req.query;
    
    // Build query
    const query = { patientId };
    
    // Add date range if specified
    if (from || to) {
      query.consensusTimestamp = {};
      if (from) query.consensusTimestamp.$gte = new Date(from);
      if (to) query.consensusTimestamp.$lte = new Date(to);
    }
    
    // Get consensus events for history
    const consensusEvents = await EWSConsensus.find(query)
      .sort({ consensusTimestamp: -1 })
      .limit(limit);
    
    if (!consensusEvents || consensusEvents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No EWS history found for this patient'
      });
    }
    
    // Map to simplified history objects
    const history = consensusEvents.map(event => ({
      consensusId: event.consensusId,
      timestamp: event.consensusTimestamp,
      score: event.consensusScore,
      clinicalRisk: event.clinicalRisk,
      validConsensus: event.validConsensus,
      consensusMethod: event.consensusMethod
    }));
    
    res.status(200).json({
      success: true,
      patientId,
      count: history.length,
      data: history
    });
  } catch (error) {
    logger.error('Error fetching patient EWS history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch patient history',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/query/consensus/{consensusId}:
 *   get:
 *     summary: Get details of a specific EWS consensus
 *     tags: [Queries]
 *     description: Get the detailed information about a specific EWS consensus event
 *     parameters:
 *       - in: path
 *         name: consensusId
 *         required: true
 *         schema:
 *           type: string
 *         description: Consensus event ID
 *     responses:
 *       200:
 *         description: Consensus details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EWSConsensus'
 *       404:
 *         description: Consensus event not found
 *       500:
 *         description: Server error
 */
router.get('/consensus/:consensusId', async (req, res) => {
  try {
    const { consensusId } = req.params;
    
    const consensus = await EWSConsensus.findOne({ consensusId });
    
    if (!consensus) {
      return res.status(404).json({
        success: false,
        message: 'Consensus event not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: consensus
    });
  } catch (error) {
    logger.error('Error fetching consensus details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch consensus details',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/query/events:
 *   get:
 *     summary: Get event history
 *     tags: [Queries]
 *     description: Get the raw events from the event store
 *     parameters:
 *       - in: query
 *         name: patientId
 *         schema:
 *           type: string
 *         description: Filter by patient ID
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *         description: Filter by event type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of items to return
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
 *     responses:
 *       200:
 *         description: List of events
 *       500:
 *         description: Server error
 */
router.get('/events', async (req, res) => {
  try {
    const { patientId, eventType, limit: limitStr, from, to } = req.query;
    const limit = parseInt(limitStr) || 20;
    
    // Build query
    const query = {};
    
    if (patientId) query.patientId = patientId;
    if (eventType) query.eventType = eventType;
    
    // Add date range if specified
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to);
    }
    
    // Get events from event store
    const events = await EWSScoreEvent.find(query)
      .sort({ timestamp: -1 })
      .limit(limit);
    
    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    logger.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/query/stats/overview:
 *   get:
 *     summary: Get EWS statistics overview
 *     tags: [Queries]
 *     description: Get statistics about EWS scores and consensus events
 *     responses:
 *       200:
 *         description: EWS statistics overview
 *       500:
 *         description: Server error
 */
router.get('/stats/overview', async (req, res) => {
  try {
    // Get total count of events
    const totalEvents = await EWSScoreEvent.countDocuments();
    
    // Get count of consensus events
    const totalConsensus = await EWSConsensus.countDocuments();
    
    // Get count of invalid consensus events
    const invalidConsensus = await EWSConsensus.countDocuments({ validConsensus: false });
    
    // Get distribution of scores
    const scoreDistribution = await EWSReadModel.aggregate([
      { $group: { 
        _id: '$currentScore', 
        count: { $sum: 1 } 
      } },
      { $sort: { _id: 1 } }
    ]);
    
    // Get distribution of clinical risk levels
    const riskDistribution = await EWSReadModel.aggregate([
      { $group: { 
        _id: '$clinicalRisk', 
        count: { $sum: 1 } 
      } }
    ]);
    
    // Format the distributions
    const formattedScoreDistribution = {};
    scoreDistribution.forEach(item => {
      formattedScoreDistribution[item._id] = item.count;
    });
    
    const formattedRiskDistribution = {};
    riskDistribution.forEach(item => {
      formattedRiskDistribution[item._id] = item.count;
    });
    
    res.status(200).json({
      success: true,
      stats: {
        totalEvents,
        totalConsensus,
        invalidConsensus,
        validConsensusPercentage: totalConsensus > 0 
          ? ((totalConsensus - invalidConsensus) / totalConsensus * 100).toFixed(2) 
          : 0,
        scoreDistribution: formattedScoreDistribution,
        riskDistribution: formattedRiskDistribution
      }
    });
  } catch (error) {
    logger.error('Error fetching EWS statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch EWS statistics',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/query/high-risk-patients:
 *   get:
 *     summary: Get list of high-risk patients
 *     tags: [Queries]
 *     description: Get a list of patients with high-risk EWS scores
 *     parameters:
 *       - in: query
 *         name: minScore
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Minimum EWS score to be considered high risk
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of patients to return
 *     responses:
 *       200:
 *         description: List of high-risk patients
 *       500:
 *         description: Server error
 */
router.get('/high-risk-patients', async (req, res) => {
  try {
    const minScore = parseInt(req.query.minScore) || 5;
    const limit = parseInt(req.query.limit) || 20;
    
    // Find patients with high-risk scores
    const highRiskPatients = await EWSReadModel.find({ currentScore: { $gte: minScore } })
      .sort({ currentScore: -1, lastUpdated: -1 })
      .limit(limit);
    
    res.status(200).json({
      success: true,
      count: highRiskPatients.length,
      minScore,
      data: highRiskPatients
    });
  } catch (error) {
    logger.error('Error fetching high-risk patients:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch high-risk patients',
      error: error.message
    });
  }
});

module.exports = router;