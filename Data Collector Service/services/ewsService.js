const axios = require('axios');
const { logger } = require('../utils/logger');

// Configuration for EWS Calculator Service connection
const EWS_SERVICE_URL = process.env.EWS_SERVICE_URL || 'http://localhost:3002/api/command/calculate-ews';

/**
 * Send vital sign data to the EWS Service for score calculation
 * 
 * @param {Object} vitalSigns - The vital signs data to send
 * @param {String} patientId - The patient's ID
 * @param {String} nodeId - The node that collected the data
 * @returns {Promise} - Promise resolving to the EWS calculation response
 */
const calculateEWS = async (vitalSigns, patientId, nodeId) => {
  try {
    const payload = {
      patientId,
      nodeId,
      vitalSigns,
      timestamp: new Date(),
      metadata: { source: 'data-collector-service' }
    };

    logger.info(`Sending vital signs to EWS service for patient ${patientId}`, { 
      patientId, 
      nodeId,
      vitalSignTypes: Object.keys(vitalSigns)
    });

    const response = await axios.post(EWS_SERVICE_URL, payload);
    
    logger.info(`EWS calculation successful for patient ${patientId}`, {
      patientId,
      totalScore: response.data.totalScore,
      clinicalRisk: response.data.clinicalRisk
    });
    
    return response.data;
  } catch (error) {
    logger.error(`Error calculating EWS: ${error.message}`, {
      patientId,
      error: error.response ? error.response.data : error.message
    });
    throw new Error(`Failed to calculate EWS: ${error.message}`);
  }
};

module.exports = {
  calculateEWS
};