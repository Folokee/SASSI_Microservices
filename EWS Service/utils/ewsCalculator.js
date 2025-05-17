/**
 * Early Warning Score (EWS) Calculator
 * This utility calculates EWS scores based on vital sign measurements
 * and implements RAFT consensus for score agreement between nodes.
 */

/**
 * Calculate EWS score based on vital signs
 * Using the National Early Warning Score (NEWS) 2 standard
 * @param {Object} vitalSigns - Object containing vital sign measurements
 * @returns {Object} Calculated scores and risk assessment
 */
const calculateEWS = (vitalSigns) => {
  // Initialize score components
  const scoreComponents = {
    respiratoryRate: 0,
    oxygenSaturation: 0,
    temperature: 0,
    systolicBP: 0,
    heartRate: 0,
    consciousness: 0
  };
  
  // Respiratory rate (breaths per minute)
  if (vitalSigns.respiratoryRate <= 8) {
    scoreComponents.respiratoryRate = 3;
  } else if (vitalSigns.respiratoryRate >= 9 && vitalSigns.respiratoryRate <= 11) {
    scoreComponents.respiratoryRate = 1;
  } else if (vitalSigns.respiratoryRate >= 12 && vitalSigns.respiratoryRate <= 20) {
    scoreComponents.respiratoryRate = 0;
  } else if (vitalSigns.respiratoryRate >= 21 && vitalSigns.respiratoryRate <= 24) {
    scoreComponents.respiratoryRate = 2;
  } else if (vitalSigns.respiratoryRate >= 25) {
    scoreComponents.respiratoryRate = 3;
  }
  
  // Oxygen saturation (%)
  if (vitalSigns.oxygenSaturation <= 91) {
    scoreComponents.oxygenSaturation = 3;
  } else if (vitalSigns.oxygenSaturation >= 92 && vitalSigns.oxygenSaturation <= 93) {
    scoreComponents.oxygenSaturation = 2;
  } else if (vitalSigns.oxygenSaturation >= 94 && vitalSigns.oxygenSaturation <= 95) {
    scoreComponents.oxygenSaturation = 1;
  } else if (vitalSigns.oxygenSaturation >= 96) {
    scoreComponents.oxygenSaturation = 0;
  }
  
  // Temperature (°C)
  if (vitalSigns.temperature <= 35.0) {
    scoreComponents.temperature = 3;
  } else if (vitalSigns.temperature >= 35.1 && vitalSigns.temperature <= 36.0) {
    scoreComponents.temperature = 1;
  } else if (vitalSigns.temperature >= 36.1 && vitalSigns.temperature <= 38.0) {
    scoreComponents.temperature = 0;
  } else if (vitalSigns.temperature >= 38.1 && vitalSigns.temperature <= 39.0) {
    scoreComponents.temperature = 1;
  } else if (vitalSigns.temperature >= 39.1) {
    scoreComponents.temperature = 2;
  }
  
  // Systolic blood pressure (mmHg)
  if (vitalSigns.systolicBP <= 90) {
    scoreComponents.systolicBP = 3;
  } else if (vitalSigns.systolicBP >= 91 && vitalSigns.systolicBP <= 100) {
    scoreComponents.systolicBP = 2;
  } else if (vitalSigns.systolicBP >= 101 && vitalSigns.systolicBP <= 110) {
    scoreComponents.systolicBP = 1;
  } else if (vitalSigns.systolicBP >= 111 && vitalSigns.systolicBP <= 219) {
    scoreComponents.systolicBP = 0;
  } else if (vitalSigns.systolicBP >= 220) {
    scoreComponents.systolicBP = 3;
  }
  
  // Heart rate (beats per minute)
  if (vitalSigns.heartRate <= 40) {
    scoreComponents.heartRate = 3;
  } else if (vitalSigns.heartRate >= 41 && vitalSigns.heartRate <= 50) {
    scoreComponents.heartRate = 1;
  } else if (vitalSigns.heartRate >= 51 && vitalSigns.heartRate <= 90) {
    scoreComponents.heartRate = 0;
  } else if (vitalSigns.heartRate >= 91 && vitalSigns.heartRate <= 110) {
    scoreComponents.heartRate = 1;
  } else if (vitalSigns.heartRate >= 111 && vitalSigns.heartRate <= 130) {
    scoreComponents.heartRate = 2;
  } else if (vitalSigns.heartRate >= 131) {
    scoreComponents.heartRate = 3;
  }
  
  // Consciousness (AVPU scale)
  if (vitalSigns.consciousness === 'Alert') {
    scoreComponents.consciousness = 0;
  } else if (['Voice', 'Pain', 'Unresponsive'].includes(vitalSigns.consciousness)) {
    scoreComponents.consciousness = 3;
  }
  
  // Calculate total score
  const totalScore = Object.values(scoreComponents).reduce((sum, score) => sum + score, 0);
  
  // Determine clinical risk
  let clinicalRisk = 'Low';
  if (totalScore >= 7) {
    clinicalRisk = 'High';
  } else if (totalScore >= 5) {
    clinicalRisk = 'Medium';
  } else if (totalScore >= 1) {
    clinicalRisk = 'Low-Medium';
  }
  
  return {
    scoreComponents,
    totalScore,
    clinicalRisk
  };
};

/**
 * Determine consensus on EWS scores from multiple nodes
 * @param {Array} nodeScores - Array of node scores with values and timestamps
 * @param {Object} options - Configuration options
 * @returns {Object} Consensus result
 */
const determineConsensus = (nodeScores, options = {}) => {
  // Default options
  const config = {
    timestampThreshold: 5000, // 5 seconds tolerance in timestamp differences
    scoreThreshold: 1, // Tolerance in score differences
    ...options
  };
  
  if (!nodeScores || nodeScores.length === 0) {
    return {
      consensusScore: null,
      consensusTimestamp: null,
      validConsensus: false,
      consensusMethod: null,
      clinicalRisk: null
    };
  }
  
  // If only one score, that's the consensus
  if (nodeScores.length === 1) {
    return {
      consensusScore: nodeScores[0].totalScore,
      consensusTimestamp: nodeScores[0].timestamp,
      validConsensus: true,
      consensusMethod: 'single',
      clinicalRisk: nodeScores[0].clinicalRisk || determineClinicalRisk(nodeScores[0].totalScore)
    };
  }
  
  // Check if timestamps are within threshold
  const timestamps = nodeScores.map(n => new Date(n.timestamp).getTime());
  const minTimestamp = Math.min(...timestamps);
  const maxTimestamp = Math.max(...timestamps);
  const timeRange = maxTimestamp - minTimestamp;
  
  // If time range is too large, use the latest data
  if (timeRange > config.timestampThreshold) {
    const latestScore = nodeScores.reduce((latest, current) => {
      return new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest;
    }, nodeScores[0]);
    
    return {
      consensusScore: latestScore.totalScore,
      consensusTimestamp: latestScore.timestamp,
      validConsensus: true,
      consensusMethod: 'latest',
      clinicalRisk: latestScore.clinicalRisk || determineClinicalRisk(latestScore.totalScore)
    };
  }
  
  // If timestamps are close, check for score consensus (majority vote)
  const scoreGroups = {};
  nodeScores.forEach(node => {
    if (!scoreGroups[node.totalScore]) {
      scoreGroups[node.totalScore] = [];
    }
    scoreGroups[node.totalScore].push(node);
  });
  
  // Find the score with the most occurrences
  let majorityScore = null;
  let majorityCount = 0;
  let majorityTimestamp = null;
  
  Object.keys(scoreGroups).forEach(score => {
    if (scoreGroups[score].length > majorityCount) {
      majorityScore = parseInt(score);
      majorityCount = scoreGroups[score].length;
      
      // Add safety checks to prevent the error
      if (scoreGroups[score].length > 0 && scoreGroups[score][0] && scoreGroups[score][0].timestamp) {
        majorityTimestamp = scoreGroups[score].reduce((latest, current) => {
          // Add null check for current.timestamp
          if (!current || !current.timestamp) return latest;
          return new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest;
        }, scoreGroups[score][0]).timestamp;
      } else {
        // Fallback to current time if no valid timestamps found
        majorityTimestamp = new Date();
        console.log('Warning: No valid timestamps found in consensus group, using current time');
      }
    }
  });
  
  // Check if there's a clear majority (more than half)
  const hasMajority = majorityCount > nodeScores.length / 2;
  
  // If no clear majority, check if scores are within threshold of each other
  if (!hasMajority) {
    // Calculate average score
    const sum = nodeScores.reduce((total, node) => total + node.totalScore, 0);
    const avgScore = Math.round(sum / nodeScores.length);
    
    // Check if all scores are within threshold
    const allWithinThreshold = nodeScores.every(node => {
      return Math.abs(node.totalScore - avgScore) <= config.scoreThreshold;
    });
    
    if (allWithinThreshold) {
      // Use average as consensus score
      return {
        consensusScore: avgScore,
        consensusTimestamp: new Date(maxTimestamp),
        validConsensus: true,
        consensusMethod: 'average',
        clinicalRisk: determineClinicalRisk(avgScore)
      };
    } else {
      // No consensus reached - mark as invalid
      return {
        consensusScore: avgScore, // Still provide the average but mark it invalid
        consensusTimestamp: new Date(maxTimestamp),
        validConsensus: false,
        consensusMethod: 'none',
        clinicalRisk: determineClinicalRisk(avgScore)
      };
    }
  }
  
  // Return majority consensus
  return {
    consensusScore: majorityScore,
    consensusTimestamp: majorityTimestamp,
    validConsensus: true,
    consensusMethod: 'majority',
    clinicalRisk: determineClinicalRisk(majorityScore)
  };
};

/**
 * Determine clinical risk based on EWS score
 * @param {Number} score - The EWS score
 * @returns {String} Clinical risk level
 */
const determineClinicalRisk = (score) => {
  if (score >= 7) {
    return 'High';
  } else if (score >= 5) {
    return 'Medium';
  } else if (score >= 1) {
    return 'Low-Medium';
  } else {
    return 'Low';
  }
};

module.exports = {
  calculateEWS,
  determineConsensus,
  determineClinicalRisk
};