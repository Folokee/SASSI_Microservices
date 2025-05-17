const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

/**
 * @swagger
 * components:
 *   schemas:
 *     Alert:
 *       type: object
 *       required:
 *         - alertId
 *         - patientId
 *         - alertType
 *         - alertSeverity
 *         - message
 *         - timestamp
 *       properties:
 *         alertId:
 *           type: string
 *           description: Unique identifier for the alert
 *         patientId:
 *           type: string
 *           description: The ID of the patient
 *         sourceService:
 *           type: string
 *           description: The service that generated the alert
 *         alertType:
 *           type: string
 *           enum: [EWS_CRITICAL, EWS_URGENT, EWS_ELEVATED, EWS_DATA_INCONSISTENCY, SENSOR_CRITICAL, SENSOR_WARNING, SYSTEM_ERROR]
 *           description: Type of alert
 *         alertSeverity:
 *           type: string
 *           enum: [HIGH, MEDIUM, LOW]
 *           description: Severity level of the alert
 *         message:
 *           type: string
 *           description: Alert message description
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: The time when the alert was generated
 *         sensorData:
 *           type: object
 *           description: Sensor data that triggered the alert (if applicable)
 *         ewsData:
 *           type: object
 *           description: EWS data that triggered the alert (if applicable)
 *         status:
 *           type: string
 *           enum: [NEW, ACKNOWLEDGED, RESOLVED, ESCALATED]
 *           default: NEW
 *           description: Current status of the alert
 *         priority:
 *           type: number
 *           description: Priority level (1-100, higher means more urgent)
 *         acknowledgedBy:
 *           type: string
 *           description: ID of user who acknowledged the alert
 *         acknowledgedAt:
 *           type: string
 *           format: date-time
 *           description: Time when the alert was acknowledged
 *         resolvedBy:
 *           type: string
 *           description: ID of user who resolved the alert
 *         resolvedAt:
 *           type: string
 *           format: date-time
 *           description: Time when the alert was resolved
 *         notificationsSent:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               notificationId:
 *                 type: string
 *               channel:
 *                 type: string
 *               recipient:
 *                 type: string
 *               sentAt:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *       example:
 *         alertId: "a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890"
 *         patientId: "P12345"
 *         sourceService: "EWS-Calculator"
 *         alertType: "EWS_CRITICAL"
 *         alertSeverity: "HIGH"
 *         message: "Critical EWS score (9) - Immediate medical attention required"
 *         timestamp: "2025-05-17T16:45:00Z"
 *         ewsData: { 
 *           ewsScore: 9,
 *           clinicalRisk: "High"
 *         }
 *         status: "NEW"
 *         priority: 90
 *         notificationsSent: [
 *           {
 *             notificationId: "n1234567",
 *             channel: "SMS",
 *             recipient: "+12025550123",
 *             sentAt: "2025-05-17T16:46:00Z",
 *             status: "DELIVERED"
 *           }
 *         ]
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AlertSubscription:
 *       type: object
 *       required:
 *         - subscriptionId
 *         - subscriberType
 *         - subscriberId
 *         - channels
 *       properties:
 *         subscriptionId:
 *           type: string
 *           description: Unique identifier for the subscription
 *         subscriberType:
 *           type: string
 *           enum: [STAFF, DEPARTMENT, PATIENT_RELATIVE]
 *           description: Type of subscriber
 *         subscriberId:
 *           type: string
 *           description: ID of the subscriber (staff ID, department ID, etc.)
 *         patientId:
 *           type: string
 *           description: Patient ID (if subscription is for a specific patient)
 *         alertTypes:
 *           type: array
 *           items:
 *             type: string
 *           description: Types of alerts to subscribe to (empty means all)
 *         minSeverity:
 *           type: string
 *           enum: [HIGH, MEDIUM, LOW]
 *           default: MEDIUM
 *           description: Minimum severity level to trigger notification
 *         channels:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [EMAIL, SMS, PUSH, IN_APP]
 *               contact:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *                 default: true
 *           description: Notification channels and contact information
 *         scheduleEnabled:
 *           type: boolean
 *           default: false
 *           description: Whether notifications follow a schedule
 *         schedule:
 *           type: object
 *           description: Schedule configuration for notifications
 *         active:
 *           type: boolean
 *           default: true
 *           description: Whether the subscription is active
 *       example:
 *         subscriptionId: "s1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890"
 *         subscriberType: "STAFF"
 *         subscriberId: "NURSE-1234"
 *         patientId: "P12345"
 *         alertTypes: ["EWS_CRITICAL", "EWS_URGENT"]
 *         minSeverity: "MEDIUM"
 *         channels: [
 *           {
 *             type: "SMS",
 *             contact: "+12025550123",
 *             enabled: true
 *           },
 *           {
 *             type: "EMAIL",
 *             contact: "nurse@hospital.com",
 *             enabled: true
 *           }
 *         ]
 *         scheduleEnabled: false
 *         active: true
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       required:
 *         - notificationId
 *         - alertId
 *         - channel
 *         - recipient
 *       properties:
 *         notificationId:
 *           type: string
 *           description: Unique identifier for the notification
 *         alertId:
 *           type: string
 *           description: ID of the alert that triggered this notification
 *         patientId:
 *           type: string
 *           description: ID of the patient associated with the alert
 *         channel:
 *           type: string
 *           enum: [EMAIL, SMS, PUSH, IN_APP]
 *           description: Notification channel
 *         recipient:
 *           type: string
 *           description: Recipient address (email, phone number, device ID)
 *         recipientName:
 *           type: string
 *           description: Name of the recipient
 *         content:
 *           type: string
 *           description: Content of the notification
 *         status:
 *           type: string
 *           enum: [PENDING, SENT, DELIVERED, FAILED]
 *           default: PENDING
 *           description: Current status of the notification
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Time when the notification was created
 *         sentAt:
 *           type: string
 *           format: date-time
 *           description: Time when the notification was sent
 *         deliveredAt:
 *           type: string
 *           format: date-time
 *           description: Time when the notification was delivered
 *         errorMessage:
 *           type: string
 *           description: Error message if notification failed
 *       example:
 *         notificationId: "n1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890"
 *         alertId: "a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890"
 *         patientId: "P12345"
 *         channel: "SMS"
 *         recipient: "+12025550123"
 *         recipientName: "Dr. Jane Smith"
 *         content: "ALERT: Patient P12345 has critical EWS score (9). Immediate attention required."
 *         status: "DELIVERED"
 *         createdAt: "2025-05-17T16:45:30Z"
 *         sentAt: "2025-05-17T16:46:00Z"
 *         deliveredAt: "2025-05-17T16:46:05Z"
 */

// Alert Schema
const alertSchema = new mongoose.Schema({
  alertId: {
    type: String,
    required: true,
    default: uuidv4,
    unique: true,
    index: true
  },
  patientId: {
    type: String,
    required: true,
    index: true
  },
  sourceService: {
    type: String,
    required: false,
    default: 'Unknown'
  },
  alertType: {
    type: String,
    enum: ['EWS_CRITICAL', 'EWS_URGENT', 'EWS_ELEVATED', 'EWS_DATA_INCONSISTENCY', 
           'SENSOR_CRITICAL', 'SENSOR_WARNING', 'SYSTEM_ERROR','BELOW_THRESHOLD', 'ABOVE_THRESHOLD','DATA_INCONSISTENCY'],
    required: true,
    index: true
  },
  alertSeverity: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  sensorData: {
    type: Object,
    default: null
  },
  ewsData: {
    type: Object,
    default: null
  },
  status: {
    type: String,
    enum: ['NEW', 'ACKNOWLEDGED', 'RESOLVED', 'ESCALATED'],
    default: 'NEW',
    index: true
  },
  priority: {
    type: Number,
    min: 1,
    max: 100,
    default: 50,
    index: true
  },
  acknowledgedBy: {
    type: String,
    default: null
  },
  acknowledgedAt: {
    type: Date,
    default: null
  },
  resolvedBy: {
    type: String,
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  notificationsSent: [{
    notificationId: String,
    channel: String,
    recipient: String,
    sentAt: Date,
    status: String
  }]
}, { timestamps: true });

// Alert Subscription Schema
const alertSubscriptionSchema = new mongoose.Schema({
  subscriptionId: {
    type: String,
    required: true,
    default: uuidv4,
    unique: true,
    index: true
  },
  subscriberType: {
    type: String,
    enum: ['STAFF', 'DEPARTMENT', 'PATIENT_RELATIVE'],
    required: true
  },
  subscriberId: {
    type: String,
    required: true,
    index: true
  },
  patientId: {
    type: String,
    default: null,
    index: true
  },
  alertTypes: {
    type: [String],
    default: []
  },
  minSeverity: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    default: 'MEDIUM'
  },
  channels: [{
    type: {
        type: String,
        enum: ['EMAIL'],
        required: true
    },
    contact: {
        type: String,
        required: true
    },
    enabled: {
        type: Boolean,
        default: true
    }
    }],
  scheduleEnabled: {
    type: Boolean,
    default: false
  },
  schedule: {
    type: Object,
    default: null
  },
  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Notification Schema
const notificationSchema = new mongoose.Schema({
  notificationId: {
    type: String,
    required: true,
    default: uuidv4,
    unique: true,
    index: true
  },
  alertId: {
    type: String,
    required: true,
    index: true
  },
  patientId: {
    type: String,
    required: true,
    index: true
  },
  channel: {
    type: String,
    enum: ['EMAIL', 'SMS', 'PUSH', 'IN_APP'],
    required: true
  },
  recipient: {
    type: String,
    required: true
  },
  recipientName: {
    type: String,
    default: null
  },
  content: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'SENT', 'DELIVERED', 'FAILED'],
    default: 'PENDING',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  sentAt: {
    type: Date,
    default: null
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  errorMessage: {
    type: String,
    default: null
  }
}, { timestamps: true });

// Create models
const Alert = mongoose.model('Alert', alertSchema);
const AlertSubscription = mongoose.model('AlertSubscription', alertSubscriptionSchema);
const Notification = mongoose.model('Notification', notificationSchema);

module.exports = { 
  Alert,
  AlertSubscription,
  Notification
};