const amqp = require('amqplib');
const { logger } = require('../utils/logger');

// AMQP connection URL
const AMQP_URL = process.env.AMQP_URL || 'amqp://guest:guest@localhost:5672?frameMax=0';
const EXCHANGE_NAME = 'ews_events';

let connection = null;
let channel = null;

/**
 * Initialize the event bus connection
 */
const initialize = async (retryCount = 0) => {
  try {
    logger.info(`Connecting to RabbitMQ at ${AMQP_URL}`);
    
    // Connect with specific socket options to set frame_max
    const socketOptions = {
      frameMax: 0,  // Use server's value (typically 128KB)
      channelMax: 0  // Use server's value
    };
    
    connection = await amqp.connect(AMQP_URL, socketOptions);
    
    // Add connection error handler
    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error:', err);
      if (connection) {
        connection.close();
        connection = null;
      }
      channel = null;
    });
    
    channel = await connection.createChannel();
    
    // Create exchange
    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
    
    logger.info('Event bus connection established successfully');
    return { connection, channel };
  } catch (error) {
    logger.error(`Failed to initialize event bus (attempt ${retryCount + 1}):`, error);
    
    // Development mode fallback
    if (process.env.NODE_ENV === 'development') {
      logger.info('Creating mock event bus for development');
      channel = {
        publish: (exchange, routingKey, content) => {
          logger.info(`[MOCK] Published to ${exchange}:${routingKey}`, JSON.parse(content.toString()));
          return true;
        }
      };
      return { connection: null, channel };
    } else {
      throw error;
    }
  }
};

/**
 * Publish an event to the event bus
 * 
 * @param {String} eventType - The type of event (routing key)
 * @param {Object} eventData - The event data to publish
 * @returns {Promise<Boolean>} Success status
 */
const publishEvent = async (eventType, eventData) => {
  try {
    // Initialize if not already done
    if (!channel) {
      await initialize();
    }
    
    // Publish the event
    const content = Buffer.from(JSON.stringify(eventData));
    const result = channel.publish(EXCHANGE_NAME, eventType, content, {
      contentType: 'application/json',
      persistent: true
    });
    
    logger.info(`Published event ${eventType}`, { eventId: eventData.eventId || eventData._id });
    return result;
  } catch (error) {
    logger.error(`Error publishing event ${eventType}:`, error);
    return false;
  }
};

/**
 * Subscribe to events of a certain type
 * 
 * @param {String} eventType - The type of event to subscribe to (routing key)
 * @param {Function} handler - The event handler function
 * @returns {Promise<Object>} The subscription details
 */
const subscribeToEvent = async (eventType, handler) => {
  try {
    // Initialize if not already done
    if (!channel) {
      await initialize();
    }
    
    // Create a queue for this subscriber
    const queueName = `ews_queue_${eventType.replace('.', '_')}`;
    await channel.assertQueue(queueName, { durable: true });
    await channel.bindQueue(queueName, EXCHANGE_NAME, eventType);
    
    // Consume messages from the queue
    await channel.consume(queueName, async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          await handler(content);
          channel.ack(msg);
        } catch (error) {
          logger.error(`Error handling event ${eventType}:`, error);
          // Reject the message and requeue
          channel.nack(msg, false, true);
        }
      }
    });
    
    logger.info(`Subscribed to event type: ${eventType}`);
    return { eventType, queueName };
  } catch (error) {
    logger.error(`Error subscribing to event ${eventType}:`, error);
    throw error;
  }
};

// Initialize the event bus on startup
initialize().catch(err => {
  logger.error('Failed to initialize event bus, will retry on first use:', err);
});

module.exports = {
  publishEvent,
  subscribeToEvent,
  initialize
};