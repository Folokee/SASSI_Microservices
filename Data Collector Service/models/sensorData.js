const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     SensorData:
 *       type: object
 *       required:
 *         - patientId
 *         - sensorType
 *         - value
 *         - timestamp
 *         - nodeId
 *       properties:
 *         patientId:
 *           type: string
 *           description: The ID of the patient
 *         sensorType:
 *           type: string
 *           description: Type of the medical sensor (e.g., heartRate, temperature)
 *         value:
 *           type: number
 *           description: The value recorded by the sensor
 *         unit:
 *           type: string
 *           description: Unit of measurement (e.g., bpm, °C)
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: The time when the data was collected
 *         nodeId:
 *           type: string
 *           description: ID of the edge node that collected the data
 *         metadata:
 *           type: object
 *           description: Additional metadata about the reading
 *       example:
 *         patientId: "P12345"
 *         sensorType: "heartRate"
 *         value: 75
 *         unit: "bpm"
 *         timestamp: "2025-05-17T16:45:00Z"
 *         nodeId: "node-1"
 *         metadata: { location: "Room 302", deviceId: "HR-SENSOR-442" }
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ConsensusData:
 *       type: object
 *       required:
 *         - patientId
 *         - sensorType
 *         - readings
 *         - consensusValue
 *         - consensusTimestamp
 *       properties:
 *         patientId:
 *           type: string
 *           description: The ID of the patient
 *         sensorType:
 *           type: string
 *           description: Type of the medical sensor
 *         readings:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               nodeId:
 *                 type: string
 *               value:
 *                 type: number
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *         consensusValue:
 *           type: number
 *           description: The agreed-upon sensor value after consensus
 *         consensusTimestamp:
 *           type: string
 *           format: date-time
 *           description: Timestamp of when consensus was reached
 *         validConsensus:
 *           type: boolean
 *           description: Whether a valid consensus was reached
 *         consensusMethod:
 *           type: string
 *           enum: [majority, latest]
 *           description: Method used to reach consensus
 *       example:
 *         patientId: "P12345"
 *         sensorType: "temperature"
 *         readings: [
 *           { nodeId: "node-1", value: 37.2, timestamp: "2025-05-17T16:45:00Z" },
 *           { nodeId: "node-2", value: 37.1, timestamp: "2025-05-17T16:45:01Z" },
 *           { nodeId: "node-3", value: 37.2, timestamp: "2025-05-17T16:45:02Z" }
 *         ]
 *         consensusValue: 37.2
 *         consensusTimestamp: "2025-05-17T16:45:10Z"
 *         validConsensus: true
 *         consensusMethod: "majority"
 */

const sensorDataSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    index: true
  },
  sensorType: {
    type: String,
    required: true,
    index: true
  },
  value: {
    type: Number,
    required: true
  },
  unit: {
    type: String,
    required: false
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  nodeId: {
    type: String,
    required: true,
    index: true
  },
  metadata: {
    type: Object,
    default: {}
  }
}, { timestamps: true });

const consensusDataSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    index: true
  },
  sensorType: {
    type: String,
    required: true,
    index: true
  },
  readings: [{
    nodeId: String,
    value: Number,
    timestamp: Date
  }],
  consensusValue: {
    type: Number,
    required: true
  },
  consensusTimestamp: {
    type: Date,
    required: true,
    index: true
  },
  validConsensus: {
    type: Boolean,
    default: true
  },
  consensusMethod: {
    type: String,
    enum: ['majority', 'latest', 'average', 'single'],
    required: true
  }
}, { timestamps: true });

const SensorData = mongoose.model('SensorData', sensorDataSchema);
const ConsensusData = mongoose.model('ConsensusData', consensusDataSchema);

module.exports = { SensorData, ConsensusData };