const express = require('express');
const router = express.Router();
const { SensorData, ConsensusData } = require('../models/sensorData');
const consensusUtil = require('../utils/consensus');
const alertService = require('../services/alertService');
const { logger } = require('../utils/logger');
const ewsHelper = require('../utils/ewsHelper');
const ewsService = require('../services/ewsService');

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
    timeWindow.setSeconds(timeWindow.getSeconds() - 300000); // Look at readings in the last 30 seconds
    
    const recentReadings = await SensorData.find({
      patientId: newReading.patientId,
      sensorType: newReading.sensorType,
      timestamp: { 
        $gte: timeWindow,
        $lte: new Date(newReading.timestamp.getTime() + 500000) // Allow readings up to 5 seconds after
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
    if (readings.length >= 3) {
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
      
      // After saving consensus, check if we have all vital signs needed for EWS calculation
      await checkAndTriggerEWSCalculation(newReading.patientId);
    }
  } catch (error) {
    logger.error('Error creating consensus:', error);
  }
}

/**
 * Check if all required vital signs for EWS calculation are available
 * and trigger EWS calculation if they are
 * @param {String} patientId - The patient's ID 
 */
async function checkAndTriggerEWSCalculation(patientId) {
  try {
    // Find the most recent consensus data for each vital sign type for this patient
    const latestConsensusData = await ConsensusData.aggregate([
      // Match documents for this patient with valid consensus
      { $match: { 
        patientId: patientId,
        validConsensus: true 
      }},
      // Sort by timestamp descending (newest first)
      { $sort: { consensusTimestamp: -1 }},
      // Group by sensorType, keeping only the most recent document for each
      { $group: {
        _id: '$sensorType',
        consensusId: { $first: '$_id' },
        sensorType: { $first: '$sensorType' },
        consensusValue: { $first: '$consensusValue' },
        consensusTimestamp: { $first: '$consensusTimestamp' },
        nodeId: { $first: '$readings.nodeId' } // Get the first node ID from readings array
      }},
      // Sort results by timestamp to get the most recent ones first
      { $sort: { consensusTimestamp: -1 }}
    ]);
    
    // Check if we have consensus data older than 5 minutes (consider them outdated)
    const fiveMinutesAgo = new Date(Date.now() - 50000 * 60 * 1000);
    
    // Convert the consensus data to a vital signs object
    const vitalSigns = {};
    let oldestTimestamp = new Date();
    let sourceNodeId = null;
    
    latestConsensusData.forEach(consensus => {
      // Map the sensor type to the EWS vital sign name
      const ewsVitalName = ewsHelper.mapSensorTypeToEWS(consensus.sensorType);
      
      // Skip if this timestamp is too old
      if (new Date(consensus.consensusTimestamp) < fiveMinutesAgo) {
        logger.info(`Skipping outdated vital sign ${ewsVitalName} for patient ${patientId}`, {
          consensusTimestamp: consensus.consensusTimestamp,
          currentTime: new Date()
        });
        return;
      }
      
      // Add to vital signs object
      vitalSigns[ewsVitalName] = consensus.consensusValue;
      
      // Track the oldest timestamp to use for the EWS calculation
      if (new Date(consensus.consensusTimestamp) < oldestTimestamp) {
        oldestTimestamp = new Date(consensus.consensusTimestamp);
      }
      
      // Use the first node ID we find as the source
      if (!sourceNodeId && consensus.nodeId) {
        sourceNodeId = Array.isArray(consensus.nodeId) ? consensus.nodeId[0] : consensus.nodeId;
      }
    });

    // After the loop that processes all vital signs:
    if (vitalSigns.consciousness !== undefined) {
      vitalSigns.consciousness = ewsHelper.mapConsciousnessValue(vitalSigns.consciousness);
    }
    
    // If consciousness is missing but we have other vital signs, set a default of "Alert"
    // (this is optional and depends on your requirements)
    if (!vitalSigns.consciousness && Object.keys(vitalSigns).length > 0) {
      vitalSigns.consciousness = "Alert";
      logger.info(`Using default consciousness value "Alert" for patient ${patientId}`);
    }
    
    // Check if we have all required vital signs
    if (ewsHelper.hasAllRequiredVitalSigns(vitalSigns)) {
      logger.info(`All required vital signs available for patient ${patientId}, calculating EWS`, {
        vitalSigns: Object.keys(vitalSigns)
      });
      
      // Use the first node ID we found, or a default if none is available
      const nodeId = sourceNodeId || 'data-collector-node';
      
      // Call the EWS service to calculate the score
      await ewsService.calculateEWS(vitalSigns, patientId, nodeId);
    } else {
      const missing = ewsHelper.REQUIRED_VITAL_SIGNS.filter(vital => !vitalSigns[vital]);
      logger.debug(`Not all vital signs available for patient ${patientId}, missing: ${missing.join(', ')}`);
    }
  } catch (error) {
    logger.error(`Error checking vital signs for EWS calculation: ${error.message}`, {
      patientId,
      error: error.stack
    });
  }
}

module.exports = router;