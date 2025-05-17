/**
 * RAFT Consensus implementation for sensor data
 * This utility implements a simplified RAFT consensus algorithm
 * to validate and agree on sensor data values from multiple edge nodes
 */

/**
 * Determine the consensus value from multiple node readings
 * @param {Array} readings - Array of node readings with values and timestamps
 * @param {Object} options - Configuration options
 * @returns {Object} Consensus result
 */
const determineConsensus = (readings, options = {}) => {
  // Default options
  const config = {
    timestampThreshold: 5000, // 5 seconds tolerance in timestamp differences
    valueThreshold: 0.2, // 20% tolerance in value differences
    ...options
  };
  
  if (!readings || readings.length === 0) {
    return {
      consensusValue: null,
      consensusTimestamp: null,
      validConsensus: false,
      consensusMethod: null
    };
  }
  
  // If only one reading, that's the consensus
  if (readings.length === 1) {
    return {
      consensusValue: readings[0].value,
      consensusTimestamp: readings[0].timestamp,
      validConsensus: true,
      consensusMethod: 'single'
    };
  }
  
  // Check if timestamps are within threshold
  const timestamps = readings.map(r => new Date(r.timestamp).getTime());
  const minTimestamp = Math.min(...timestamps);
  const maxTimestamp = Math.max(...timestamps);
  const timeRange = maxTimestamp - minTimestamp;
  
  // If time range is too large, use the latest data
  if (timeRange > config.timestampThreshold) {
    const latestReading = readings.reduce((latest, current) => {
      return new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest;
    }, readings[0]);
    
    return {
      consensusValue: latestReading.value,
      consensusTimestamp: latestReading.timestamp,
      validConsensus: true,
      consensusMethod: 'latest'
    };
  }
  
  // If timestamps are close, check for value consensus (majority vote)
  const valueGroups = {};
  readings.forEach(reading => {
    if (!valueGroups[reading.value]) {
      valueGroups[reading.value] = [];
    }
    valueGroups[reading.value].push(reading);
  });
  
  // Find the value with the most occurrences
  let majorityValue = null;
  let majorityCount = 0;
  let majorityTimestamp = null;
  
  Object.keys(valueGroups).forEach(value => {
    if (valueGroups[value].length > majorityCount) {
      majorityValue = parseFloat(value);
      majorityCount = valueGroups[value].length;
      
      // Add safety checks to prevent the error
      if (valueGroups[value].length > 0 && valueGroups[value][0] && valueGroups[value][0].timestamp) {
        // Find the reading with the latest timestamp from this group
        majorityTimestamp = valueGroups[value].reduce((latest, current) => {
          // Add null check for current.timestamp
          if (!current || !current.timestamp) return latest;
          return new Date(current.timestamp) > new Date(latest) ? current.timestamp : latest;
        }, valueGroups[value][0].timestamp);
      } else {
        // Fallback to current time if no valid timestamps found
        majorityTimestamp = new Date().toISOString();
        console.log('Warning: No valid timestamps found in value group, using current time');
      }
    }
  });
  
  // Check if there's a clear majority (more than half)
  const hasMajority = majorityCount > readings.length / 2;
  
  // If no clear majority, check if values are within threshold of each other
  if (!hasMajority) {
    // Calculate average value
    const sum = readings.reduce((total, reading) => total + reading.value, 0);
    const avgValue = sum / readings.length;
    
    // Check if all values are within threshold
    const allWithinThreshold = readings.every(reading => {
      const percentDiff = Math.abs(reading.value - avgValue) / avgValue;
      return percentDiff <= config.valueThreshold;
    });
    
    if (allWithinThreshold) {
      // Use average as consensus value
      return {
        consensusValue: avgValue,
        consensusTimestamp: new Date(maxTimestamp),
        validConsensus: true,
        consensusMethod: 'average'
      };
    } else {
      // No consensus reached - mark as invalid
      return {
        consensusValue: avgValue, // Still provide the average but mark it invalid
        consensusTimestamp: new Date(maxTimestamp),
        validConsensus: false,
        consensusMethod: 'none'
      };
    }
  }
  
  // Return majority consensus
  return {
    consensusValue: majorityValue,
    consensusTimestamp: majorityTimestamp,
    validConsensus: true,
    consensusMethod: 'majority'
  };
};

/**
 * Check if a reading needs urgent attention and should trigger an alert
 * @param {Object} consensusData - The consensus data object
 * @param {Object} thresholds - Alert thresholds for different sensor types
 * @returns {Object} Alert information
 */
const checkForAlert = (consensusData, thresholds = {}) => {
  // Default thresholds for common vital signs
  const defaultThresholds = {
    heartRate: { low: 40, high: 120 },
    temperature: { low: 35, high: 39 },
    bloodPressureSystolic: { low: 90, high: 180 },
    bloodPressureDiastolic: { low: 60, high: 120 },
    oxygenSaturation: { low: 90, high: 100 },
    respiratoryRate: { low: 8, high: 25 }
  };
  
  const allThresholds = { ...defaultThresholds, ...thresholds };
  const { sensorType, consensusValue, validConsensus } = consensusData;
  
  // If consensus is not valid, mark as requiring review
  if (!validConsensus) {
    return {
      requiresAlert: true,
      alertType: 'DATA_INCONSISTENCY',
      alertSeverity: 'MEDIUM',
      message: `Inconsistent data detected for ${sensorType}`
    };
  }
  
  // If we don't have thresholds for this sensor type, can't determine alert
  if (!allThresholds[sensorType]) {
    return {
      requiresAlert: false,
      alertType: null,
      alertSeverity: null,
      message: null
    };
  }
  
  const { low, high } = allThresholds[sensorType];
  
  if (consensusValue < low) {
    return {
      requiresAlert: true,
      alertType: 'BELOW_THRESHOLD',
      alertSeverity: 'HIGH',
      message: `${sensorType} reading (${consensusValue}) below critical threshold (${low})`
    };
  }
  
  if (consensusValue > high) {
    return {
      requiresAlert: true,
      alertType: 'ABOVE_THRESHOLD',
      alertSeverity: 'HIGH',
      message: `${sensorType} reading (${consensusValue}) above critical threshold (${high})`
    };
  }
  
  return {
    requiresAlert: false,
    alertType: null,
    alertSeverity: null,
    message: null
  };
};

module.exports = {
  determineConsensus,
  checkForAlert
};