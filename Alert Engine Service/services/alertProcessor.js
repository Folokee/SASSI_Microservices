const { Alert, AlertSubscription } = require('../models/alert');
const notificationService = require('./notificationService');
const { logger } = require('../utils/logger');

/**
 * Process and prioritize a new alert
 * 
 * @param {Object} alertData - Alert data to process
 * @returns {Promise<Object>} Processed alert
 */
const processAlert = async (alertData) => {
  try {
    // Calculate priority based on alert type and severity
    const priority = calculatePriority(alertData);
    
    // Create alert object with priority
    const alert = new Alert({
      ...alertData,
      priority,
      status: 'NEW'
    });
    
    // Save alert to database
    await alert.save();
    
    // Find relevant subscriptions and send notifications
    await sendAlertNotifications(alert);
    
    logger.info(`Alert processed: ${alert.alertId}`, {
      alertType: alert.alertType,
      severity: alert.alertSeverity,
      patientId: alert.patientId,
      priority
    });
    
    return alert;
  } catch (error) {
    logger.error('Error processing alert:', error);
    throw error;
  }
};

/**
 * Calculate priority score for an alert based on type and severity
 * 
 * @param {Object} alert - The alert to calculate priority for
 * @returns {Number} Priority score (1-100)
 */
const calculatePriority = (alert) => {
  // Base priority by severity
  let priority = 0;
  
  switch (alert.alertSeverity) {
    case 'HIGH':
      priority = 80;
      break;
    case 'MEDIUM':
      priority = 50;
      break;
    case 'LOW':
      priority = 30;
      break;
    default:
      priority = 10;
  }
  
  // Adjust priority based on alert type
  switch (alert.alertType) {
    case 'EWS_CRITICAL':
      priority += 20;
      break;
    case 'EWS_URGENT':
      priority += 15;
      break;
    case 'EWS_ELEVATED':
      priority += 10;
      break;
    case 'SENSOR_CRITICAL':
      priority += 18;
      break;
    case 'SENSOR_WARNING':
      priority += 8;
      break;
    default:
      priority += 0;
  }
  
  // Ensure priority is within bounds
  priority = Math.max(1, Math.min(100, priority));
  
  return priority;
};

/**
 * Find relevant subscriptions and send notifications for an alert
 * 
 * @param {Object} alert - The alert to send notifications for
 * @returns {Promise<Array>} Array of notification results
 */
const sendAlertNotifications = async (alert) => {
  try {
    // Find all relevant subscriptions for this alert
    const subscriptions = await findRelevantSubscriptions(alert);
    
    if (!subscriptions || subscriptions.length === 0) {
      logger.info(`No subscriptions found for alert ${alert.alertId}`);
      return [];
    }
    
    logger.info(`Found ${subscriptions.length} subscriptions for alert ${alert.alertId}`);
    
    // Send notifications for each subscription
    const notificationPromises = subscriptions.map(subscription => 
      sendSubscriptionNotifications(alert, subscription)
    );
    
    // Wait for all notifications to be processed
    const results = await Promise.allSettled(notificationPromises);
    
    // Update alert with notification info
    const sentNotifications = results
      .filter(result => result.status === 'fulfilled' && result.value)
      .flatMap(result => result.value);
    
    if (sentNotifications.length > 0) {
      // Update alert with notification info
      await Alert.findOneAndUpdate(
        { alertId: alert.alertId },
        { 
          $push: { 
            notificationsSent: { 
              $each: sentNotifications.map(n => ({
                notificationId: n.notificationId,
                channel: n.channel,
                recipient: n.recipient,
                sentAt: n.sentAt || new Date(),
                status: n.status
              }))
            } 
          } 
        }
      );
    }
    
    return sentNotifications;
  } catch (error) {
    logger.error(`Error sending notifications for alert ${alert.alertId}:`, error);
    return [];
  }
};

/**
 * Find relevant subscriptions for an alert
 * 
 * @param {Object} alert - The alert to find subscriptions for
 * @returns {Promise<Array>} Array of matching subscriptions
 */
const findRelevantSubscriptions = async (alert) => {
  // Build query for relevant subscriptions
  const query = {
    active: true,
    $or: [
      // Specific for this patient
      { patientId: alert.patientId },
      // General subscriptions (no specific patient)
      { patientId: null }
    ]
  };
  
  // Filter by minimum severity
  switch (alert.alertSeverity) {
    case 'HIGH':
      // All severity levels get HIGH alerts
      break;
    case 'MEDIUM':
      // MEDIUM and LOW severity subscribers get MEDIUM alerts
      query.minSeverity = { $in: ['MEDIUM', 'LOW'] };
      break;
    case 'LOW':
      // Only LOW severity subscribers get LOW alerts
      query.minSeverity = 'LOW';
      break;
    default:
      break;
  }
  
  // Filter by alert type if specified in subscription
  query.$or = query.$or || [];
  query.$or.push(
    { alertTypes: { $size: 0 } }, // Empty array means all types
    { alertTypes: alert.alertType }
  );
  
  // Find matching subscriptions
  return AlertSubscription.find(query);
};

/**
 * Send notifications for a single subscription
 * 
 * @param {Object} alert - The alert to send notifications for
 * @param {Object} subscription - The subscription to use
 * @returns {Promise<Array>} Array of notification results
 */
const sendSubscriptionNotifications = async (alert, subscription) => {
  try {
    const results = [];
    
    // Find email channels in the subscription
    const emailChannels = subscription.channels.filter(c => 
      c.enabled && c.type === 'EMAIL'
    );
    
    if (emailChannels.length === 0) {
      logger.info(`No email channels configured for subscription ${subscription.subscriptionId}`);
      return [];
    }
    
    // Create notification content
    const content = createNotificationContent(alert, subscription, 'EMAIL');
    
    // Send email to each recipient
    for (const channel of emailChannels) {
      try {
        const notification = await notificationService.sendNotification({
          alertId: alert.alertId,
          patientId: alert.patientId,
          recipient: channel.contact,
          recipientName: `${subscription.subscriberType}-${subscription.subscriberId}`,
          content
        });
        
        if (notification) {
          results.push(notification);
        }
      } catch (error) {
        logger.error(`Error sending email notification:`, error);
      }
    }
    
    return results;
  } catch (error) {
    logger.error('Error in sendSubscriptionNotifications:', error);
    return [];
  }
};

/**
 * Create notification content based on alert, subscription, and channel
 * 
 * @param {Object} alert - The alert to create content for
 * @param {Object} subscription - The subscription to use
 * @param {String} channelType - The notification channel type
 * @returns {String} Notification content
 */
const createNotificationContent = (alert, subscription, channelType) => {
  let content = '';
  
  // Base prefix based on severity
  const prefix = alert.alertSeverity === 'HIGH' ? 'CRITICAL ALERT: ' :
                 alert.alertSeverity === 'MEDIUM' ? 'URGENT ALERT: ' :
                 'ALERT: ';
  
  // Base content with patient ID and message
  content = `${prefix}Patient ${alert.patientId} - ${alert.message}`;
  
  // Add EWS information if available
  if (alert.ewsData) {
    content += ` EWS Score: ${alert.ewsData.ewsScore}, Risk: ${alert.ewsData.clinicalRisk}.`;
  }
  
  // Add timestamp
  const timestamp = new Date(alert.timestamp).toLocaleString();
  content += ` Time: ${timestamp}`;
  
  // Channel-specific formatting
  switch (channelType) {
    case 'SMS':
      // Keep SMS brief
      if (content.length > 160) {
        content = content.substring(0, 157) + '...';
      }
      break;
    case 'EMAIL':
      // More details in email
      content = `
        <h2>${prefix}Medical Alert</h2>
        <p><strong>Patient ID:</strong> ${alert.patientId}</p>
        <p><strong>Alert Type:</strong> ${alert.alertType}</p>
        <p><strong>Severity:</strong> ${alert.alertSeverity}</p>
        <p><strong>Message:</strong> ${alert.message}</p>
        ${alert.ewsData ? `
        <p><strong>EWS Score:</strong> ${alert.ewsData.ewsScore}</p>
        <p><strong>Clinical Risk:</strong> ${alert.ewsData.clinicalRisk}</p>
        ` : ''}
        <p><strong>Time:</strong> ${timestamp}</p>
        <p>Please respond to this alert according to hospital protocols.</p>
      `;
      break;
    default:
      // Default format
      break;
  }
  
  return content;
};

/**
 * Acknowledge an alert
 * 
 * @param {String} alertId - ID of the alert to acknowledge
 * @param {String} userId - ID of the user acknowledging the alert
 * @returns {Promise<Object>} Updated alert
 */
const acknowledgeAlert = async (alertId, userId) => {
  try {
    const alert = await Alert.findOne({ alertId });
    
    if (!alert) {
      throw new Error(`Alert with ID ${alertId} not found`);
    }
    
    if (alert.status !== 'NEW' && alert.status !== 'ESCALATED') {
      throw new Error(`Alert is already ${alert.status}, cannot acknowledge`);
    }
    
    alert.status = 'ACKNOWLEDGED';
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();
    
    await alert.save();
    
    logger.info(`Alert ${alertId} acknowledged by ${userId}`);
    
    return alert;
  } catch (error) {
    logger.error(`Error acknowledging alert ${alertId}:`, error);
    throw error;
  }
};

/**
 * Resolve an alert
 * 
 * @param {String} alertId - ID of the alert to resolve
 * @param {String} userId - ID of the user resolving the alert
 * @param {String} resolution - Optional resolution notes
 * @returns {Promise<Object>} Updated alert
 */
const resolveAlert = async (alertId, userId, resolution) => {
  try {
    const alert = await Alert.findOne({ alertId });
    
    if (!alert) {
      throw new Error(`Alert with ID ${alertId} not found`);
    }
    
    if (alert.status === 'RESOLVED') {
      throw new Error('Alert is already resolved');
    }
    
    alert.status = 'RESOLVED';
    alert.resolvedBy = userId;
    alert.resolvedAt = new Date();
    
    if (resolution) {
      alert.resolution = resolution;
    }
    
    await alert.save();
    
    logger.info(`Alert ${alertId} resolved by ${userId}`);
    
    return alert;
  } catch (error) {
    logger.error(`Error resolving alert ${alertId}:`, error);
    throw error;
  }
};

/**
 * Escalate an alert
 * 
 * @param {String} alertId - ID of the alert to escalate
 * @param {String} reason - Reason for escalation
 * @returns {Promise<Object>} Updated alert
 */
const escalateAlert = async (alertId, reason) => {
  try {
    const alert = await Alert.findOne({ alertId });
    
    if (!alert) {
      throw new Error(`Alert with ID ${alertId} not found`);
    }
    
    if (alert.status === 'RESOLVED') {
      throw new Error('Cannot escalate a resolved alert');
    }
    
    alert.status = 'ESCALATED';
    alert.priority = Math.min(100, alert.priority + 10); // Increase priority
    alert.escalationReason = reason || 'Automatic escalation due to lack of response';
    
    await alert.save();
    
    // Find higher-level subscriptions for escalation
    const escalationSubscriptions = await AlertSubscription.find({
      active: true,
      subscriberType: 'DEPARTMENT', // Department-level subscriptions
      $or: [
        { patientId: alert.patientId },
        { patientId: null }
      ],
      minSeverity: { $in: ['HIGH'] } // Only high severity subscribers for escalations
    });
    
    // Send escalation notifications
    if (escalationSubscriptions.length > 0) {
      for (const subscription of escalationSubscriptions) {
        await sendSubscriptionNotifications(alert, subscription);
      }
    }
    
    logger.info(`Alert ${alertId} escalated: ${reason}`);
    
    return alert;
  } catch (error) {
    logger.error(`Error escalating alert ${alertId}:`, error);
    throw error;
  }
};

module.exports = {
  processAlert,
  calculatePriority,
  sendAlertNotifications,
  acknowledgeAlert,
  resolveAlert,
  escalateAlert
};