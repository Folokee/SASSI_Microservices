/**
 * Utility functions for EWS integration
 */

// Required vital signs for EWS calculation based on NEWS2 standard
const REQUIRED_VITAL_SIGNS = [
  'respiratoryRate',
  'oxygenSaturation',
  'temperature', 
  'systolicBP',
  'heartRate',
  'consciousness'
];

// Mapping from sensor type names to EWS vital sign names
const SENSOR_TO_EWS_MAPPING = {
  'respRate': 'respiratoryRate',
  'spo2': 'oxygenSaturation',
  'temperature': 'temperature',
  'bpSystolic': 'systolicBP',
  'heartRate': 'heartRate',
  'consciousness': 'consciousness'
};

// Mapping from numerical consciousness values to AVPU scale strings
const CONSCIOUSNESS_MAP = {
  0: 'Alert',
  1: 'Voice',
  2: 'Pain',
  3: 'Unresponsive'
};

/**
 * Check if all vital signs required for EWS calculation are available
 * @param {Object} vitalSigns - Object containing collected vital signs
 * @returns {Boolean} - True if all required vital signs are present
 */
const hasAllRequiredVitalSigns = (vitalSigns) => {
  return REQUIRED_VITAL_SIGNS.every(vital => 
    vitalSigns[vital] !== undefined && vitalSigns[vital] !== null
  );
};

/**
 * Map sensor type to EWS vital sign name
 * @param {String} sensorType - The sensor type from Data Collector
 * @returns {String} - Corresponding EWS vital sign name
 */
const mapSensorTypeToEWS = (sensorType) => {
  return SENSOR_TO_EWS_MAPPING[sensorType] || sensorType;
};


/**
 * Convert numeric consciousness value to AVPU scale string
 * @param {Number} value - Numeric consciousness value (0-3)
 * @returns {String} - AVPU scale value (Alert, Voice, Pain, Unresponsive)
 */
const mapConsciousnessValue = (value) => {
  // Make sure it's treated as a number
  const numValue = parseInt(value, 10);
  
  // Check if it's a valid number in our range
  if (Number.isInteger(numValue) && numValue >= 0 && numValue <= 3) {
    return CONSCIOUSNESS_MAP[numValue];
  }
  
  // If it's already a string from the AVPU scale, return it
  if (typeof value === 'string' && 
      ['Alert', 'Voice', 'Pain', 'Unresponsive'].includes(value)) {
    return value;
  }
  
  // Default to Alert if invalid value
  console.warn(`Invalid consciousness value: ${value}, defaulting to "Alert"`);
  return 'Alert';
};

module.exports = {
  REQUIRED_VITAL_SIGNS,
  SENSOR_TO_EWS_MAPPING,
  hasAllRequiredVitalSigns,
  mapSensorTypeToEWS,
  mapConsciousnessValue
};