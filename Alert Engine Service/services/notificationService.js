const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const { Notification } = require('../models/alert');
const { logger } = require('../utils/logger');

// Email transporter
let emailTransporter;

/**
 * Initialize email transport
 * Sets up the nodemailer transporter with SMTP configuration
 */
const initEmailTransporter = () => {
  // Use environment variables for configuration
  const emailConfig = {
    host: process.env.EMAIL_HOST || 'smtp.test.io',
    port: parseInt(process.env.EMAIL_PORT) || 2525,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || 'test',
      pass: process.env.EMAIL_PASSWORD || 'test'
    }
  };
  
  // Create reusable transporter
  emailTransporter = nodemailer.createTransport(emailConfig);
  
  // If in development mode, use ethereal email for testing
  if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_HOST) {
    logger.info('Creating test email account for development');
    
    nodemailer.createTestAccount()
      .then(testAccount => {
        logger.info('Test email account created', testAccount);
        
        emailTransporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
      })
      .catch(err => {
        logger.error('Failed to create test email account', err);
      });
  }
  
  // Verify connection
  emailTransporter.verify()
    .then(() => {
      logger.info('Email transport initialized successfully');
    })
    .catch(err => {
      logger.error('Email transport initialization failed:', err);
    });
};

/**
 * Initialize all notification services
 */
const initialize = () => {
  initEmailTransporter();
};

/**
 * Send a notification
 * 
 * @param {Object} notificationData - The notification data
 * @returns {Promise<Object>} The sent notification
 */
const sendNotification = async (notificationData) => {
  try {
    // Always use EMAIL as the channel
    const channel = 'EMAIL';
    
    // Create notification record
    const notification = new Notification({
      notificationId: uuidv4(),
      ...notificationData,
      channel,
      status: 'PENDING'
    });
    
    // Save the notification to the database
    await notification.save();
    
    // Send the email notification
    const result = await sendEmailNotification(notification);
    
    // Update notification with result
    notification.status = result.status;
    notification.sentAt = result.sentAt || new Date();
    
    if (result.deliveredAt) {
      notification.deliveredAt = result.deliveredAt;
    }
    
    if (result.errorMessage) {
      notification.errorMessage = result.errorMessage;
    }
    
    // Save updated notification
    await notification.save();
    
    logger.info(`Email notification sent: ${notification.notificationId}`, {
      status: notification.status
    });
    
    return notification;
  } catch (error) {
    logger.error('Error sending notification:', error);
    
    // If we have a notification object, update its status
    if (arguments[0].notificationId) {
      try {
        await Notification.findOneAndUpdate(
          { notificationId: arguments[0].notificationId },
          {
            status: 'FAILED',
            errorMessage: error.message
          }
        );
      } catch (updateError) {
        logger.error('Error updating failed notification:', updateError);
      }
    }
    
    throw error;
  }
};

/**
 * Send an email notification
 * 
 * @param {Object} notification - The notification to send
 * @returns {Promise<Object>} Result of the email sending
 */
const sendEmailNotification = async (notification) => {
  if (!emailTransporter) {
    initEmailTransporter();
    
    if (!emailTransporter) {
      throw new Error('Email transporter not initialized');
    }
  }
  
  try {
    // Prepare email data
    const fromAddress = process.env.EMAIL_FROM || 'from@example.com';
    const fromName = process.env.EMAIL_FROM_NAME || 'Medical Alert System';
    
    const mailOptions = {
      from: `"${fromName}" <${fromAddress}>`,
      to: notification.recipient,
      subject: `Medical Alert - ${getAlertSubject(notification)}`,
      html: notification.content,
      text: stripHtml(notification.content)
    };
    
    // Send email
    const info = await emailTransporter.sendMail(mailOptions);
    
    logger.info(`Email sent: ${info.messageId}`);
    
    // For development/testing, log preview URL
    if (process.env.NODE_ENV === 'development') {
      logger.info('Email preview URL:', nodemailer.getTestMessageUrl(info));
    }
    
    return {
      status: 'SENT',
      sentAt: new Date(),
      messageId: info.messageId
    };
  } catch (error) {
    logger.error('Error sending email:', error);
    return {
      status: 'FAILED',
      errorMessage: error.message
    };
  }
};

/**
 * Get a subject line for an alert notification
 * 
 * @param {Object} notification - The notification object
 * @returns {String} The subject line
 */
const getAlertSubject = (notification) => {
  // Extract alert type from content if possible
  let subject = 'Patient Alert';
  
  if (notification.content.includes('CRITICAL ALERT')) {
    subject = 'CRITICAL Patient Alert';
  } else if (notification.content.includes('URGENT ALERT')) {
    subject = 'URGENT Patient Alert';
  }
  
  // Add patient ID if available
  if (notification.patientId) {
    subject += ` - Patient ${notification.patientId}`;
  }
  
  return subject;
};

/**
 * Strip HTML from a string
 * 
 * @param {String} html - HTML content
 * @returns {String} Plain text content
 */
const stripHtml = (html) => {
  return html
    .replace(/<[^>]*>/g, ' ') // Replace HTML tags with spaces
    .replace(/\s+/g, ' ')     // Collapse multiple spaces
    .trim();                   // Trim whitespace
};

// Initialize on module load
initialize();

module.exports = {
  sendNotification,
  initialize
};