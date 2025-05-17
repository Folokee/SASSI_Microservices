const express = require('express');
const router = express.Router();
const { handleCalculateEWSCommand } = require('../services/commandHandler');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/command/calculate-ews:
 *   post:
 *     summary: Command to calculate an EWS score
 *     tags: [Commands]
 *     description: Submit a command to calculate an Early Warning Score for a patient
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - patientId
 *               - nodeId
 *               - vitalSigns
 *             properties:
 *               patientId:
 *                 type: string
 *                 description: The ID of the patient
 *               nodeId:
 *                 type: string
 *                 description: ID of the edge node submitting the data
 *               vitalSigns:
 *                 type: object
 *                 required:
 *                   - respiratoryRate
 *                   - oxygenSaturation
 *                   - temperature
 *                   - systolicBP
 *                   - heartRate
 *                   - consciousness
 *                 properties:
 *                   respiratoryRate:
 *                     type: number
 *                     description: Breaths per minute
 *                   oxygenSaturation:
 *                     type: number
 *                     description: Blood oxygen saturation percentage
 *                   temperature:
 *                     type: number
 *                     description: Body temperature in Celsius
 *                   systolicBP:
 *                     type: number
 *                     description: Systolic blood pressure in mmHg
 *                   heartRate:
 *                     type: number
 *                     description: Heart rate in beats per minute
 *                   consciousness:
 *                     type: string
 *                     enum: [Alert, Voice, Pain, Unresponsive]
 *                     description: AVPU scale consciousness assessment
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: The time when the vitals were measured
 *               metadata:
 *                 type: object
 *                 description: Additional metadata about the reading
 *     responses:
 *       201:
 *         description: EWS calculation command processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 eventId:
 *                   type: string
 *                 totalScore:
 *                   type: number
 *                 clinicalRisk:
 *                   type: string
 *       400:
 *         description: Invalid command data
 *       500:
 *         description: Server error
 */
router.post('/calculate-ews', async (req, res) => {
  try {
    const { patientId, nodeId, vitalSigns, timestamp, metadata } = req.body;
    
    // Validate required fields
    if (!patientId || !nodeId || !vitalSigns) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: patientId, nodeId, and vitalSigns are required'
      });
    }
    
    // Validate vital signs
    const requiredVitals = ['respiratoryRate', 'oxygenSaturation', 'temperature', 
                           'systolicBP', 'heartRate', 'consciousness'];
    
    const missingVitals = requiredVitals.filter(vital => vitalSigns[vital] === undefined);
    
    if (missingVitals.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required vital signs: ${missingVitals.join(', ')}`
      });
    }
    
    // Validate consciousness value
    const validConsciousness = ['Alert', 'Voice', 'Pain', 'Unresponsive'];
    if (!validConsciousness.includes(vitalSigns.consciousness)) {
      return res.status(400).json({
        success: false,
        message: `Invalid consciousness value. Must be one of: ${validConsciousness.join(', ')}`
      });
    }
    
    // Create command object
    const command = {
      patientId,
      nodeId,
      vitalSigns,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      metadata
    };
    
    // Handle the command
    const event = await handleCalculateEWSCommand(command);
    
    // Return success response
    res.status(201).json({
      success: true,
      eventId: event.eventId,
      totalScore: event.totalScore,
      clinicalRisk: event.clinicalRisk,
      message: 'EWS calculation processed successfully'
    });
  } catch (error) {
    logger.error('Error processing calculate-ews command:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process EWS calculation',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/command/batch-calculate-ews:
 *   post:
 *     summary: Command to calculate multiple EWS scores
 *     tags: [Commands]
 *     description: Submit a batch command to calculate Early Warning Scores for multiple patients or timepoints
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - calculations
 *             properties:
 *               calculations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - patientId
 *                     - nodeId
 *                     - vitalSigns
 *                   properties:
 *                     patientId:
 *                       type: string
 *                     nodeId:
 *                       type: string
 *                     vitalSigns:
 *                       type: object
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     metadata:
 *                       type: object
 *     responses:
 *       201:
 *         description: Batch EWS calculations processed
 *       400:
 *         description: Invalid command data
 *       500:
 *         description: Server error
 */
router.post('/batch-calculate-ews', async (req, res) => {
  try {
    const { calculations } = req.body;
    
    if (!Array.isArray(calculations) || calculations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'calculations must be a non-empty array'
      });
    }
    
    const results = [];
    const errors = [];
    
    // Process each calculation in the batch
    for (const calc of calculations) {
      try {
        const { patientId, nodeId, vitalSigns, timestamp, metadata } = calc;
        
        if (!patientId || !nodeId || !vitalSigns) {
          errors.push({
            calculation: calc,
            error: 'Missing required fields: patientId, nodeId, and vitalSigns'
          });
          continue;
        }
        
        const command = {
          patientId,
          nodeId,
          vitalSigns,
          timestamp: timestamp ? new Date(timestamp) : new Date(),
          metadata
        };
        
        const event = await handleCalculateEWSCommand(command);
        
        results.push({
          patientId: event.patientId,
          eventId: event.eventId,
          totalScore: event.totalScore,
          clinicalRisk: event.clinicalRisk
        });
      } catch (error) {
        errors.push({
          calculation: calc,
          error: error.message
        });
      }
    }
    
    res.status(201).json({
      success: true,
      message: `Processed ${results.length} calculations with ${errors.length} errors`,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    logger.error('Error processing batch-calculate-ews command:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process batch EWS calculations',
      error: error.message
    });
  }
});

module.exports = router;