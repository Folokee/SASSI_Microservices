const axios = require('axios');
const { logger } = require('../utils/logger');

// Configuration for Alert Engine Service connection
const ALERT_ENGINE_URL = process.env.ALERT_ENGINE_URL || 'http://localhost:3003/api/alerts';

/**
 * Send an alert to the Alert Engine Service
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
 * Process sensor data and send alert if needed
 * 
 * @param {Object} consensusData - The consensus data from sensor readings
 * @param {Object} alertInfo - Alert information generated from consensus check
 * @returns {Promise} - Promise resolving when alert is processed
 */
const processAlert = async (consensusData, alertInfo) => {
  if (!alertInfo.requiresAlert) {
    return null;
  }
  
  const alertData = {
    patientId: consensusData.patientId,
    sensorType: consensusData.sensorType,
    value: consensusData.consensusValue,
    timestamp: consensusData.consensusTimestamp,
    alertType: alertInfo.alertType,
    alertSeverity: alertInfo.alertSeverity,
    message: alertInfo.message,
    consensusData: {
      readings: consensusData.readings,
      validConsensus: consensusData.validConsensus,
      consensusMethod: consensusData.consensusMethod
    }
  };
  
  return sendAlert(alertData);
};

module.exports = {
  sendAlert,
  processAlert
};