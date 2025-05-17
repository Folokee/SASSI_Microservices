const axios = require('axios');
const { logger } = require('../utils/logger');

// Configuration for Alert Engine Service connection
const ALERT_ENGINE_URL = process.env.ALERT_ENGINE_URL || 'http://localhost:3003/api/alerts';

/**
 * Send an EWS alert to the Alert Engine Service
 * 
 * @param {Object} alertData - The alert data to send
 * @returns {Promise} - Promise resolving to the alert response
 */
const sendAlert = async (alertData) => {
  try {
    const response = await axios.post(ALERT_ENGINE_URL, alertData);
    logger.info(`Alert sent successfully: ${JSON.stringify(alertData)}`);
    return response.data;
  } catch (error) {
    logger.error(`Error sending alert: ${error.message}`, {
      alertData,
      error: error.response ? error.response.data : error.message
    });
    throw new Error(`Failed to send alert: ${error.message}`);
  }
};

/**
 * Process EWS data and send alert if needed
 * 
 * @param {Object} consensusData - The consensus data from EWS calculations
 * @returns {Promise} - Promise resolving when alert is processed
 */
const processEWSAlert = async (consensusData) => {
  // Determine alert type and severity based on EWS score
  const alertInfo = determineAlertType(consensusData);
  
  if (!alertInfo.requiresAlert) {
    return null;
  }
  
  const alertData = {
    patientId: consensusData.patientId,
    alertType: alertInfo.alertType,
    alertSeverity: alertInfo.alertSeverity,
    message: alertInfo.message,
    timestamp: consensusData.consensusTimestamp,
    ewsScore: consensusData.consensusScore,
    clinicalRisk: consensusData.clinicalRisk,
    consensusData: {
      nodeScores: consensusData.nodeScores.map(node => ({
        nodeId: node.nodeId,
        totalScore: node.totalScore,
        timestamp: node.timestamp
      })),
      validConsensus: consensusData.validConsensus,
      consensusMethod: consensusData.consensusMethod
    }
  };
  
  return sendAlert(alertData);
};

/**
 * Determine alert type and severity based on EWS consensus data
 * 
 * @param {Object} consensusData - The consensus data
 * @returns {Object} Alert information
 */
const determineAlertType = (consensusData) => {
  const { consensusScore, validConsensus, clinicalRisk } = consensusData;
  
  // If consensus is not valid, mark as requiring review
  if (!validConsensus) {
    return {
      requiresAlert: true,
      alertType: 'EWS_DATA_INCONSISTENCY',
      alertSeverity: 'MEDIUM',
      message: `Inconsistent EWS scores detected, requires clinical review`
    };
  }
  
  // High risk score (7+)
  if (consensusScore >= 7) {
    return {
      requiresAlert: true,
      alertType: 'EWS_CRITICAL',
      alertSeverity: 'HIGH',
      message: `Critical EWS score (${consensusScore}) - Immediate medical attention required`
    };
  }
  
  // Medium risk score (5-6)
  if (consensusScore >= 5 && consensusScore <= 6) {
    return {
      requiresAlert: true,
      alertType: 'EWS_URGENT',
      alertSeverity: 'MEDIUM',
      message: `Urgent EWS score (${consensusScore}) - Prompt medical attention required`
    };
  }
  
  // Low-Medium risk score with significant change
  if (consensusScore >= 3 && consensusScore <= 4) {
    // Check for significant change in score (ideally would compare with previous scores)
    return {
      requiresAlert: true,
      alertType: 'EWS_ELEVATED',
      alertSeverity: 'LOW',
      message: `Elevated EWS score (${consensusScore}) - Monitor patient closely`
    };
  }
  
  // Low risk, no alert needed
  return {
    requiresAlert: false,
    alertType: null,
    alertSeverity: null,
    message: null
  };
};

module.exports = {
  sendAlert,
  processEWSAlert,
  determineAlertType
};