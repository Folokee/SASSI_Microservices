const express = require('express');
const router = express.Router();
const { SensorData, ConsensusData } = require('../models/sensorData');
const consensusUtil = require('../utils/consensus');
const alertService = require('../services/alertService');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/data/sensor:
 *   post:
 *     summary: Submit sensor data from an edge node
 *     tags: [Sensor Data]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SensorData'
 *     responses:
 *       201:
 *         description: Sensor data recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/SensorData'
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 */
router.post('/sensor', async (req, res) => {
  try {
    const sensorData = new SensorData(req.body);
    await sensorData.save();
    
    // Attempt to create consensus with existing data
    await attemptConsensus(sensorData);
    
    res.status(201).json({
      success: true,
      message: 'Sensor data recorded successfully',
      data: sensorData
    });
  } catch (error) {
    logger.error('Error recording sensor data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record sensor data',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/data/batch:
 *   post:
 *     summary: Submit multiple sensor data readings at once
 *     tags: [Sensor Data]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               readings:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/SensorData'
 *     responses:
 *       201:
 *         description: Batch data recorded successfully
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 */
router.post('/batch', async (req, res) => {
  try {
    const { readings } = req.body;
    
    if (!Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Readings must be a non-empty array'
      });
    }
    
    const savedData = [];
    
    // Save each reading
    for (const reading of readings) {
      const sensorData = new SensorData(reading);
      await sensorData.save();
      savedData.push(sensorData);
      
      // Try to reach consensus for each patient-sensor combo
      await attemptConsensus(sensorData);
    }
    
    res.status(201).json({
      success: true,
      message: `Successfully recorded ${savedData.length} readings`,
      count: savedData.length
    });
  } catch (error) {
    logger.error('Error recording batch sensor data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record batch data',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/data/patient/{patientId}:
 *   get:
 *     summary: Get all consensus data for a specific patient
 *     tags: [Sensor Data]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
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
 *         description: List of consensus data for the patient
 *       404:
 *         description: No data found for the patient
 *       500:
 *         description: Server error
 */
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { from, to, sensorType } = req.query;
    
    const query = { patientId };
    
    // Add date filters if provided
    if (from || to) {
      query.consensusTimestamp = {};
      if (from) query.consensusTimestamp.$gte = new Date(from);
      if (to) query.consensusTimestamp.$lte = new Date(to);
    }
    
    // Add sensor type filter if provided
    if (sensorType) {
      query.sensorType = sensorType;
    }
    
    const consensusData = await ConsensusData.find(query)
      .sort({ consensusTimestamp: -1 })
      .limit(1000);
    
    if (!consensusData || consensusData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No data found for this patient'
      });
    }
    
    res.status(200).json({
      success: true,
      count: consensusData.length,
      data: consensusData
    });
  } catch (error) {
    logger.error('Error fetching patient data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch patient data',
      error: error.message
    });
  }
});

/**
 * Attempt to create consensus from recent sensor readings
 * @param {Object} newReading - The newly added sensor reading
 */
async function attemptConsensus(newReading) {
  try {
    // Find recent readings for the same patient and sensor type
    const timeWindow = new Date(newReading.timestamp);
    timeWindow.setSeconds(timeWindow.getSeconds() - 30); // Look at readings in the last 30 seconds
    
    const recentReadings = await SensorData.find({
      patientId: newReading.patientId,
      sensorType: newReading.sensorType,
      timestamp: { 
        $gte: timeWindow,
        $lte: new Date(newReading.timestamp.getTime() + 5000) // Allow readings up to 5 seconds after
      }
    }).sort({ timestamp: 1 });
    
    // Group readings by node to get the latest from each
    const nodeReadings = {};
    recentReadings.forEach(reading => {
      nodeReadings[reading.nodeId] = {
        nodeId: reading.nodeId,
        value: reading.value,
        timestamp: reading.timestamp
      };
    });
    
    // Convert to array of readings (one latest per node)
    const readings = Object.values(nodeReadings);
    
    // Only attempt consensus if we have readings from multiple nodes
    if (readings.length >= 2) {
      // Determine consensus
      const consensus = consensusUtil.determineConsensus(readings);
      
      // Save consensus data
      const consensusData = new ConsensusData({
        patientId: newReading.patientId,
        sensorType: newReading.sensorType,
        readings: readings,
        consensusValue: consensus.consensusValue,
        consensusTimestamp: consensus.consensusTimestamp,
        validConsensus: consensus.validConsensus,
        consensusMethod: consensus.consensusMethod
      });
      
      await consensusData.save();
      
      // Check if an alert is needed
      const alertInfo = consensusUtil.checkForAlert(consensusData);
      
      // Send alert if needed
      if (alertInfo.requiresAlert) {
        await alertService.processAlert(consensusData, alertInfo);
      }
      
      logger.info(`Consensus reached for patient ${newReading.patientId}, sensor ${newReading.sensorType}`, {
        validConsensus: consensus.validConsensus,
        method: consensus.consensusMethod,
        value: consensus.consensusValue
      });
    }
  } catch (error) {
    logger.error('Error creating consensus:', error);
  }
}

module.exports = router;