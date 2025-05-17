const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

/**
 * @swagger
 * components:
 *   schemas:
 *     EWSScoreEvent:
 *       type: object
 *       required:
 *         - patientId
 *         - eventId
 *         - eventType
 *         - timestamp
 *         - nodeId
 *       properties:
 *         eventId:
 *           type: string
 *           description: Unique identifier for the event
 *         patientId:
 *           type: string
 *           description: The ID of the patient
 *         nodeId:
 *           type: string
 *           description: ID of the edge node that calculated the score
 *         eventType:
 *           type: string
 *           enum: [EWS_CALCULATED, EWS_UPDATED, EWS_VALIDATED]
 *           description: Type of event
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: The time when the event occurred
 *         vitalSigns:
 *           type: object
 *           description: The vital signs used for EWS calculation
 *           properties:
 *             respiratoryRate:
 *               type: number
 *             oxygenSaturation:
 *               type: number
 *             temperature:
 *               type: number
 *             systolicBP:
 *               type: number
 *             heartRate:
 *               type: number
 *             consciousness:
 *               type: string
 *               enum: [Alert, Voice, Pain, Unresponsive]
 *         scoreComponents:
 *           type: object
 *           description: Individual scores for each vital sign
 *         totalScore:
 *           type: number
 *           description: The total EWS score
 *         clinicalRisk:
 *           type: string
 *           enum: [Low, Low-Medium, Medium, High]
 *           description: Clinical risk based on the EWS score
 *         metadata:
 *           type: object
 *           description: Additional metadata
 *       example:
 *         eventId: "e8c9d6b2-5f4e-4a3b-8c7d-6e9f0a1b2c3d"
 *         patientId: "P12345"
 *         nodeId: "node-1"
 *         eventType: "EWS_CALCULATED"
 *         timestamp: "2025-05-17T16:45:00Z"
 *         vitalSigns:
 *           respiratoryRate: 18
 *           oxygenSaturation: 96
 *           temperature: 37.1
 *           systolicBP: 125
 *           heartRate: 72
 *           consciousness: "Alert"
 *         scoreComponents:
 *           respiratoryRate: 0
 *           oxygenSaturation: 0
 *           temperature: 0
 *           systolicBP: 0
 *           heartRate: 0
 *           consciousness: 0
 *         totalScore: 0
 *         clinicalRisk: "Low"
 *         metadata: { location: "Room 302", calculatedBy: "Dr. Smith" }
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     EWSConsensus:
 *       type: object
 *       required:
 *         - patientId
 *         - consensusId
 *         - nodeScores
 *         - consensusScore
 *         - consensusTimestamp
 *       properties:
 *         consensusId:
 *           type: string
 *           description: Unique identifier for the consensus event
 *         patientId:
 *           type: string
 *           description: The ID of the patient
 *         nodeScores:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               nodeId:
 *                 type: string
 *               totalScore:
 *                 type: number
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *               vitalSigns:
 *                 type: object
 *         consensusScore:
 *           type: number
 *           description: The agreed-upon EWS score after consensus
 *         clinicalRisk:
 *           type: string
 *           enum: [Low, Low-Medium, Medium, High]
 *           description: Clinical risk based on the EWS score
 *         consensusTimestamp:
 *           type: string
 *           format: date-time
 *           description: Timestamp when consensus was reached
 *         validConsensus:
 *           type: boolean
 *           description: Whether a valid consensus was reached
 *         consensusMethod:
 *           type: string
 *           enum: [majority, latest]
 *           description: Method used to reach consensus
 *       example:
 *         consensusId: "c7d8e9f0-a1b2-4c3d-9e0f-1a2b3c4d5e6f"
 *         patientId: "P12345"
 *         nodeScores: [
 *           { 
 *             nodeId: "node-1", 
 *             totalScore: 3, 
 *             timestamp: "2025-05-17T16:45:00Z",
 *             vitalSigns: {
 *               respiratoryRate: 18,
 *               oxygenSaturation: 96,
 *               temperature: 37.1,
 *               systolicBP: 125,
 *               heartRate: 72,
 *               consciousness: "Alert"
 *             }
 *           },
 *           { 
 *             nodeId: "node-2", 
 *             totalScore: 3, 
 *             timestamp: "2025-05-17T16:45:01Z",
 *             vitalSigns: {
 *               respiratoryRate: 18,
 *               oxygenSaturation: 96,
 *               temperature: 37.1,
 *               systolicBP: 125,
 *               heartRate: 72,
 *               consciousness: "Alert"
 *             }
 *           }
 *         ]
 *         consensusScore: 3
 *         clinicalRisk: "Low-Medium"
 *         consensusTimestamp: "2025-05-17T16:45:10Z"
 *         validConsensus: true
 *         consensusMethod: "majority"
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     EWSReadModel:
 *       type: object
 *       required:
 *         - patientId
 *         - currentScore
 *         - vitalSigns
 *         - lastUpdated
 *       properties:
 *         patientId:
 *           type: string
 *           description: The ID of the patient
 *         currentScore:
 *           type: number
 *           description: The current EWS score
 *         clinicalRisk:
 *           type: string
 *           enum: [Low, Low-Medium, Medium, High]
 *           description: Clinical risk based on the EWS score
 *         vitalSigns:
 *           type: object
 *           description: The latest vital signs used for EWS calculation
 *         scoreComponents:
 *           type: object
 *           description: Individual scores for each vital sign
 *         scoreHistory:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *               score:
 *                 type: number
 *               clinicalRisk:
 *                 type: string
 *         lastUpdated:
 *           type: string
 *           format: date-time
 *           description: The time when the read model was last updated
 *       example:
 *         patientId: "P12345"
 *         currentScore: 3
 *         clinicalRisk: "Low-Medium"
 *         vitalSigns:
 *           respiratoryRate: 18
 *           oxygenSaturation: 96
 *           temperature: 37.1
 *           systolicBP: 125
 *           heartRate: 72
 *           consciousness: "Alert"
 *         scoreComponents:
 *           respiratoryRate: 0
 *           oxygenSaturation: 0
 *           temperature: 0
 *           systolicBP: 0
 *           heartRate: 1
 *           consciousness: 0
 *         scoreHistory: [
 *           { timestamp: "2025-05-17T12:30:00Z", score: 2, clinicalRisk: "Low" },
 *           { timestamp: "2025-05-17T14:15:00Z", score: 2, clinicalRisk: "Low" },
 *           { timestamp: "2025-05-17T16:45:00Z", score: 3, clinicalRisk: "Low-Medium" }
 *         ]
 *         lastUpdated: "2025-05-17T16:45:10Z"
 */

// Event store schema - following event sourcing pattern
const ewsScoreEventSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    default: uuidv4,
    index: true
  },
  patientId: {
    type: String,
    required: true,
    index: true
  },
  nodeId: {
    type: String,
    required: true
  },
  eventType: {
    type: String,
    enum: ['EWS_CALCULATED', 'EWS_UPDATED', 'EWS_VALIDATED'],
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  vitalSigns: {
    respiratoryRate: Number,
    oxygenSaturation: Number,
    temperature: Number,
    systolicBP: Number,
    heartRate: Number,
    consciousness: {
      type: String,
      enum: ['Alert', 'Voice', 'Pain', 'Unresponsive']
    }
  },
  scoreComponents: {
    respiratoryRate: Number,
    oxygenSaturation: Number,
    temperature: Number,
    systolicBP: Number,
    heartRate: Number,
    consciousness: Number
  },
  totalScore: {
    type: Number,
    required: true,
    index: true
  },
  clinicalRisk: {
    type: String,
    enum: ['Low', 'Low-Medium', 'Medium', 'High'],
    required: true
  },
  metadata: {
    type: Object,
    default: {}
  }
}, { timestamps: true });

// Consensus schema - for RAFT consensus between nodes
const ewsConsensusSchema = new mongoose.Schema({
  consensusId: {
    type: String,
    required: true,
    default: uuidv4,
    index: true
  },
  patientId: {
    type: String,
    required: true,
    index: true
  },
  nodeScores: [{
    nodeId: String,
    totalScore: Number,
    timestamp: Date,
    vitalSigns: {
      respiratoryRate: Number,
      oxygenSaturation: Number,
      temperature: Number,
      systolicBP: Number,
      heartRate: Number,
      consciousness: String
    },
    scoreComponents: {
      respiratoryRate: Number,
      oxygenSaturation: Number,
      temperature: Number,
      systolicBP: Number,
      heartRate: Number,
      consciousness: Number
    }
  }],
  consensusScore: {
    type: Number,
    required: true
  },
  clinicalRisk: {
    type: String,
    enum: ['Low', 'Low-Medium', 'Medium', 'High'],
    required: true
  },
  consensusTimestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  validConsensus: {
    type: Boolean,
    default: true
  },
  consensusMethod: {
    type: String,
    enum: ['majority', 'latest', 'average', 'single', 'none'],
    required: true
  }
}, { timestamps: true });

// Read model schema - for CQRS pattern (optimized for reads)
const ewsReadModelSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  currentScore: {
    type: Number,
    required: true,
    index: true
  },
  clinicalRisk: {
    type: String,
    enum: ['Low', 'Low-Medium', 'Medium', 'High'],
    required: true
  },
  vitalSigns: {
    respiratoryRate: Number,
    oxygenSaturation: Number,
    temperature: Number,
    systolicBP: Number,
    heartRate: Number,
    consciousness: String
  },
  scoreComponents: {
    respiratoryRate: Number,
    oxygenSaturation: Number,
    temperature: Number,
    systolicBP: Number,
    heartRate: Number,
    consciousness: Number
  },
  scoreHistory: [{
    timestamp: Date,
    score: Number,
    clinicalRisk: String
  }],
  lastUpdated: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

const EWSScoreEvent = mongoose.model('EWSScoreEvent', ewsScoreEventSchema);
const EWSConsensus = mongoose.model('EWSConsensus', ewsConsensusSchema);
const EWSReadModel = mongoose.model('EWSReadModel', ewsReadModelSchema);

module.exports = { 
  EWSScoreEvent,
  EWSConsensus,
  EWSReadModel
};