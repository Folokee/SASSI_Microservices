const { EWSScoreEvent, EWSConsensus, EWSReadModel } = require('../models/ews');
const ewsCalculator = require('../utils/ewsCalculator');
const alertService = require('./alertService');
const { logger } = require('../utils/logger');
const { publishEvent } = require('./eventBus');

/**
 * Handle the command to calculate an EWS score
 * 
 * @param {Object} command - The command data
 * @returns {Promise<Object>} The created event
 */
const handleCalculateEWSCommand = async (command) => {
  try {
    // Calculate the EWS score
    const { scoreComponents, totalScore, clinicalRisk } = ewsCalculator.calculateEWS(command.vitalSigns);
    
    // Create an event
    const event = new EWSScoreEvent({
      patientId: command.patientId,
      nodeId: command.nodeId,
      eventType: 'EWS_CALCULATED',
      timestamp: command.timestamp || new Date(),
      vitalSigns: command.vitalSigns,
      scoreComponents,
      totalScore,
      clinicalRisk,
      metadata: command.metadata || {}
    });
    
    await event.save();
    
    // Publish the event for subscribers
    await publishEvent('ews.calculated', event);
    
    // Attempt to reach consensus with other node scores
    await attemptConsensus(event);
    
    return event;
  } catch (error) {
    logger.error('Error handling Calculate EWS command:', error);
    throw error;
  }
};

/**
 * Try to reach consensus with other node scores
 * 
 * @param {Object} event - The new EWS calculation event
 * @returns {Promise<void>}
 */
const attemptConsensus = async (event) => {
  try {
    // Find recent EWS calculations for the same patient
    const timeWindow = new Date(event.timestamp);
    timeWindow.setSeconds(timeWindow.getSeconds() - 30); // Look at events in the last 30 seconds
    
    const recentEvents = await EWSScoreEvent.find({
      patientId: event.patientId,
      eventType: 'EWS_CALCULATED',
      timestamp: { 
        $gte: timeWindow,
        $lte: new Date(event.timestamp.getTime() + 5000) // Allow events up to 5 seconds after
      }
    }).sort({ timestamp: 1 });
    
    // Group events by node to get the latest from each
    const nodeScores = {};
    recentEvents.forEach(evt => {
      nodeScores[evt.nodeId] = {
        nodeId: evt.nodeId,
        totalScore: evt.totalScore,
        timestamp: evt.timestamp,
        vitalSigns: evt.vitalSigns,
        scoreComponents: evt.scoreComponents,
        clinicalRisk: evt.clinicalRisk
      };
    });
    
    // Convert to array of scores (one latest per node)
    const scores = Object.values(nodeScores);
    
    // Only attempt consensus if we have scores from multiple nodes
    if (scores.length >= 2) {
      // Determine consensus
      const consensus = ewsCalculator.determineConsensus(scores);
      
      // Save consensus data
      const consensusData = new EWSConsensus({
        patientId: event.patientId,
        nodeScores: scores,
        consensusScore: consensus.consensusScore,
        clinicalRisk: consensus.clinicalRisk,
        consensusTimestamp: consensus.consensusTimestamp,
        validConsensus: consensus.validConsensus,
        consensusMethod: consensus.consensusMethod
      });
      
      await consensusData.save();
      
      // Update the read model
      await updateReadModel(consensusData);
      
      // Check if an alert is needed based on the score
      if (consensus.consensusScore >= 5 || !consensus.validConsensus) {
        await alertService.processEWSAlert(consensusData);
      }
      
      logger.info(`EWS consensus reached for patient ${event.patientId}`, {
        validConsensus: consensus.validConsensus,
        method: consensus.consensusMethod,
        score: consensus.consensusScore,
        risk: consensus.clinicalRisk
      });
      
      // Publish the consensus event
      await publishEvent('ews.consensus', consensusData);
    }
  } catch (error) {
    logger.error('Error creating EWS consensus:', error);
  }
};

/**
 * Update the read model with the latest consensus data
 * 
 * @param {Object} consensusData - The consensus data
 * @returns {Promise<void>}
 */
const updateReadModel = async (consensusData) => {
  try {
    // Find existing read model or create a new one
    let readModel = await EWSReadModel.findOne({ patientId: consensusData.patientId });
    
    if (!readModel) {
      // Create a new read model if none exists
      readModel = new EWSReadModel({
        patientId: consensusData.patientId,
        currentScore: consensusData.consensusScore,
        clinicalRisk: consensusData.clinicalRisk,
        // Get the vital signs from the node with the consensus score
        vitalSigns: consensusData.nodeScores.find(
          node => node.totalScore === consensusData.consensusScore
        )?.vitalSigns || consensusData.nodeScores[0].vitalSigns,
        // Get the score components from the node with the consensus score
        scoreComponents: consensusData.nodeScores.find(
          node => node.totalScore === consensusData.consensusScore
        )?.scoreComponents || consensusData.nodeScores[0].scoreComponents,
        scoreHistory: [{
          timestamp: consensusData.consensusTimestamp,
          score: consensusData.consensusScore,
          clinicalRisk: consensusData.clinicalRisk
        }],
        lastUpdated: consensusData.consensusTimestamp
      });
    } else {
      // Update existing read model
      readModel.currentScore = consensusData.consensusScore;
      readModel.clinicalRisk = consensusData.clinicalRisk;
      readModel.lastUpdated = consensusData.consensusTimestamp;
      
      // Update vital signs and score components if we have a valid consensus
      if (consensusData.validConsensus) {
        // Get data from the node with the consensus score
        const nodeWithConsensusScore = consensusData.nodeScores.find(
          node => node.totalScore === consensusData.consensusScore
        ) || consensusData.nodeScores[0];
        
        readModel.vitalSigns = nodeWithConsensusScore.vitalSigns;
        readModel.scoreComponents = nodeWithConsensusScore.scoreComponents;
      }
      
      // Add to score history, limiting to last 100 entries
      readModel.scoreHistory.push({
        timestamp: consensusData.consensusTimestamp,
        score: consensusData.consensusScore,
        clinicalRisk: consensusData.clinicalRisk
      });
      
      // Limit history to last 100 entries
      if (readModel.scoreHistory.length > 100) {
        readModel.scoreHistory = readModel.scoreHistory.slice(-100);
      }
    }
    
    await readModel.save();
    
    logger.info(`Read model updated for patient ${consensusData.patientId}`, {
      score: consensusData.consensusScore,
      risk: consensusData.clinicalRisk
    });
  } catch (error) {
    logger.error('Error updating read model:', error);
    throw error;
  }
};

module.exports = {
  handleCalculateEWSCommand,
  attemptConsensus,
  updateReadModel
};