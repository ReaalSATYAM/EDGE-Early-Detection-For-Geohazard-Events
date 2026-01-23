/**
 * Physics Engine - Landslide Risk Calculation
 * Based on fisical_fos.py and run_quick_demo.py
 * Implements Infinite Slope Factor of Safety (FoS) Model
 * Enhanced with progressive simulation and realistic behavior
 */

class PhysicsEngine {
    constructor() {
        // Constants from backend
        this.GAMMA_W = 9.81; // Water unit weight (kN/m³)
        this.EFFECTIVE_POROSITY = 0.3;
        this.RISK_THRESHOLD = 0.75;

        // Default soil parameters (from backend ranges)
        this.defaults = {
            slopeAngle: 35,        // degrees
            rainfallIntensity: 35,  // mm/hr
            rainfallDuration: 1.0,  // days
            soilCohesion: 15,       // kPa
            frictionAngle: 30,      // degrees
            initialSaturation: 50,  // percentage
            soilDepth: 2.0,         // meters
            unitWeight: 18.0,       // kN/m³
            ksat: 1e-6              // m/s (hydraulic conductivity)
        };

        // Simulation state for progressive behavior
        this.simulationState = {
            currentSaturation: 50,  // percentage (evolves over time)
            accumulatedRainfall: 0, // mm
            timeElapsed: 0,         // hours
            isRunning: false
        };
    }

    /**
     * Reset simulation state to initial conditions
     */
    resetSimulation() {
        this.simulationState = {
            currentSaturation: 50,
            accumulatedRainfall: 0,
            timeElapsed: 0,
            isRunning: false
        };
    }

    /**
     * Update simulation state progressively (called each animation frame)
     * @param {number} deltaTime - Time step in hours
     * @param {object} params - Current parameters
     */
    updateSimulation(deltaTime, params) {
        if (!this.simulationState.isRunning) return;

        // Accumulate rainfall
        const rainfallThisStep = params.rainfallIntensity * deltaTime; // mm
        this.simulationState.accumulatedRainfall += rainfallThisStep;
        this.simulationState.timeElapsed += deltaTime;

        // Simplified infiltration: saturation increases with rainfall
        const maxSaturation = 90; // cap at 90%
        const saturationIncrease = (rainfallThisStep / (params.soilDepth * 1000)) * 100; // rough approximation
        this.simulationState.currentSaturation = Math.min(
            maxSaturation,
            this.simulationState.currentSaturation + saturationIncrease
        );
    }

    /**
     * Compute Factor of Safety using Infinite Slope Model
     * Directly ported from compute_fos_vectorized in fisical_fos.py
     */
    computeFoS(params, useSimulationState = false) {
        const {
            slopeAngle,
            rainfallIntensity,
            rainfallDuration,
            soilCohesion,
            frictionAngle,
            initialSaturation,
            soilDepth = this.defaults.soilDepth,
            unitWeight = this.defaults.unitWeight,
            ksat = this.defaults.ksat
        } = params;

        // 1. Geometry & Inputs
        const slopeRad = this.degreesToRadians(Math.max(0.1, Math.min(89.9, slopeAngle)));
        const sinA = Math.sin(slopeRad);
        const cosA = Math.cos(slopeRad);

        const c = soilCohesion; // kPa
        const phi = frictionAngle; // degrees
        const gamma = unitWeight; // kN/m³
        const z = soilDepth; // m

        const tanPhi = Math.tan(this.degreesToRadians(phi));

        // 2. Transient Infiltration (Green-Ampt Approximation)
        // Convert rain to m/s: 1 mm/hr = 2.777e-7 m/s
        const rainRateMs = rainfallIntensity * 2.777e-7;
        // Convert days to hours for calculation
        const durationHours = rainfallDuration * 24.0;
        const durationS = durationHours * 3600.0;

        // Infiltration rate limited by Ksat or Rain Rate
        const infRate = Math.min(rainRateMs, ksat);
        const infiltrationDepthM = infRate * durationS;

        // Rise in water table due to storm
        const hwRise = infiltrationDepthM / this.EFFECTIVE_POROSITY;

        // Use simulation state saturation if running, otherwise use initial
        const currentSat = useSimulationState ?
            this.simulationState.currentSaturation :
            initialSaturation;

        // Existing water table (from current saturation)
        const saturationFraction = currentSat / 100.0;
        const hwInitial = saturationFraction * z;

        // Total water height, clamped to soil depth
        const hw = Math.max(0.0, Math.min(hwInitial + hwRise, z));

        // 3. Infinite Slope Stresses (kPa)
        // Normal Stress (Total)
        const sigmaN = gamma * z * (cosA ** 2);

        // Pore Water Pressure
        const u = this.GAMMA_W * hw * (cosA ** 2);

        // Effective Normal Stress (prevent negative stress)
        const sigmaPrime = Math.max(sigmaN - u, 0.0);

        // Shear Stress (Driving Force)
        const tau = Math.max(gamma * z * sinA * cosA, 1e-5);

        // 4. Factor of Safety Calculation
        const resisting = c + sigmaPrime * tanPhi;
        const driving = tau;

        const fos = resisting / driving;

        // 5. Clip FoS to [0, 10] for interpretable range
        return Math.max(0.0, Math.min(fos, 10.0));
    }

    /**
     * Convert FoS to Risk Probability
     * From fos_to_risk() in run_quick_demo.py
     */
    fosToRisk(fos) {
        // Conservative risk mapping using sigmoid
        // FoS < 0.9 → High risk
        // FoS ~1.0 → Medium
        // FoS > 1.2 → Safe
        return 1.0 / (1.0 + Math.exp(10.0 * (fos - 1.0)));
    }

    /**
     * Compute additional metrics for display
     */
    computeMetrics(params, useSimulationState = false) {
        const fos = this.computeFoS(params, useSimulationState);
        const risk = this.fosToRisk(fos);

        // Determine status - simplified to three states
        let status, statusClass, riskLevel, riskIcon;

        if (fos >= 1.2) {
            status = 'Stable';
            statusClass = 'safe';
            riskLevel = 'STABLE';
            riskIcon = '🟢';
        } else if (fos >= 0.9) {
            status = 'Marginal';
            statusClass = 'warning';
            riskLevel = 'MARGINAL';
            riskIcon = '🟡';
        } else {
            status = 'Failure Likely';
            statusClass = 'danger';
            riskLevel = 'FAILURE LIKELY';
            riskIcon = '🔴';
        }

        // Rainfall load classification
        let rainfallLoad;
        if (params.rainfallIntensity < 20) {
            rainfallLoad = 'Light';
        } else if (params.rainfallIntensity < 50) {
            rainfallLoad = 'Moderate';
        } else if (params.rainfallIntensity < 80) {
            rainfallLoad = 'Heavy';
        } else {
            rainfallLoad = 'Extreme';
        }

        // Slope stability classification
        let slopeStability;
        if (params.slopeAngle < 25) {
            slopeStability = 'Stable';
        } else if (params.slopeAngle < 40) {
            slopeStability = 'Moderate';
        } else {
            slopeStability = 'Critical';
        }

        // Compute pore water pressure using current saturation
        const slopeRad = this.degreesToRadians(params.slopeAngle);
        const cosA = Math.cos(slopeRad);
        const currentSat = useSimulationState ?
            this.simulationState.currentSaturation :
            params.initialSaturation;
        const saturationFraction = currentSat / 100.0;
        const hw = saturationFraction * this.defaults.soilDepth;
        const poreWaterPressure = this.GAMMA_W * hw * (cosA ** 2);

        // Generate reasoning
        const reasoning = this.generateReasoning(params, fos, risk, useSimulationState);

        return {
            fos: fos.toFixed(2),
            risk: (risk * 100).toFixed(1),
            status,
            statusClass,
            riskLevel,
            riskIcon,
            rainfallLoad,
            slopeStability,
            poreWaterPressure: poreWaterPressure.toFixed(1),
            currentSaturation: useSimulationState ?
                this.simulationState.currentSaturation.toFixed(1) :
                params.initialSaturation.toFixed(1),
            reasoning,
            shouldAlert: risk > this.RISK_THRESHOLD
        };
    }

    /**
     * Generate system reasoning based on current state
     */
    generateReasoning(params, fos, risk, useSimulationState = false) {
        const reasoning = [];

        const currentSat = useSimulationState ?
            this.simulationState.currentSaturation :
            params.initialSaturation;

        // Slope analysis
        if (params.slopeAngle < 25) {
            reasoning.push('Slope angle within safe range');
        } else if (params.slopeAngle < 40) {
            reasoning.push('Slope angle moderate - monitoring required');
        } else {
            reasoning.push('⚠ Slope angle critical - high failure potential');
        }

        // Rainfall analysis
        const totalRainfall = params.rainfallIntensity * params.rainfallDuration * 24; // mm over duration
        if (totalRainfall < 100) {
            reasoning.push('Cumulative rainfall low');
        } else if (totalRainfall < 300) {
            reasoning.push('Cumulative rainfall moderate');
        } else {
            reasoning.push('⚠ Cumulative rainfall high - saturation increasing');
        }

        // Soil strength analysis
        if (params.soilCohesion > 20) {
            reasoning.push('Soil cohesion adequate');
        } else {
            reasoning.push('⚠ Low soil cohesion - reduced shear resistance');
        }

        // Saturation analysis
        if (currentSat < 60) {
            reasoning.push('Soil saturation moderate');
        } else if (currentSat < 80) {
            reasoning.push('⚠ Soil saturation elevated - pore pressure rising');
        } else {
            reasoning.push('⚠ Soil near saturation - critical pore pressure');
        }

        // FoS analysis
        if (fos >= 1.2) {
            reasoning.push('✓ Factor of Safety above threshold - slope stable');
        } else if (fos >= 1.0) {
            reasoning.push('⚠ Factor of Safety marginal - slope at equilibrium');
        } else {
            reasoning.push('✗ Factor of Safety below 1.0 - FAILURE CONDITION');
        }

        // Risk threshold
        if (risk > this.RISK_THRESHOLD) {
            reasoning.push('✗ RISK THRESHOLD EXCEEDED - EVACUATION REQUIRED');
        } else {
            reasoning.push('No critical thresholds crossed');
        }

        return reasoning;
    }

    /**
     * Generate SMS alert message (from run_quick_demo.py)
     */
    generateSMS(lat, lon, risk, fos) {
        const riskPercent = (risk * 100).toFixed(0);
        return `ALERT: High Landslide Risk (${riskPercent}%). Loc:${lat.toFixed(4)},${lon.toFixed(4)} FoS:${fos.toFixed(2)}. AC:Immediate`;
    }

    /**
     * Utility: Degrees to Radians
     */
    degreesToRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Utility: Radians to Degrees
     */
    radiansToDegrees(radians) {
        return radians * (180 / Math.PI);
    }

    /**
     * Get default parameters
     */
    getDefaults() {
        return { ...this.defaults };
    }

    /**
     * Start progressive simulation
     */
    startSimulation(initialSaturation) {
        this.simulationState.isRunning = true;
        this.simulationState.currentSaturation = initialSaturation;
        this.simulationState.accumulatedRainfall = 0;
        this.simulationState.timeElapsed = 0;
    }

    /**
     * Stop simulation
     */
    stopSimulation() {
        this.simulationState.isRunning = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PhysicsEngine;
}
