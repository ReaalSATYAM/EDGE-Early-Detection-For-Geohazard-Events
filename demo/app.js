/**
 * Real-Time Slider-Driven Simulation
 * No "Run Simulation" button - everything reactive via sliders
 */

// Initialize components
const physicsEngine = new PhysicsEngine();
const terrainVisualizer = new TerrainVisualizer('terrainCanvas');

// Current parameters - state management
let currentParams = physicsEngine.getDefaults();

// Rain animation state
let currentRainIntensity = 35;

// DOM Elements
const elements = {
    // Sliders
    slopeAngle: document.getElementById('slopeAngle'),
    rainfallIntensity: document.getElementById('rainfallIntensity'),
    rainfallDuration: document.getElementById('rainfallDuration'),
    soilCohesion: document.getElementById('soilCohesion'),
    frictionAngle: document.getElementById('frictionAngle'),
    initialSaturation: document.getElementById('initialSaturation'),

    // Value displays
    slopeValue: document.getElementById('slopeValue'),
    rainfallValue: document.getElementById('rainfallValue'),
    durationValue: document.getElementById('durationValue'),
    cohesionValue: document.getElementById('cohesionValue'),
    frictionValue: document.getElementById('frictionValue'),
    saturationValue: document.getElementById('saturationValue'),

    // Buttons
    resetButton: document.getElementById('resetButton'),

    // Metrics displays
    fosValue: document.getElementById('fosValue'),
    fosStatus: document.getElementById('fosStatus'),
    rainfallLoad: document.getElementById('rainfallLoad'),
    rainfallDetail: document.getElementById('rainfallDetail'),
    slopeStability: document.getElementById('slopeStability'),
    slopeDetail: document.getElementById('slopeDetail'),
    poreWaterPressure: document.getElementById('poreWaterPressure'),
    poreWaterDetail: document.getElementById('poreWaterDetail'),
    reasoningList: document.getElementById('reasoningList'),

    // Risk displays
    riskIndicator: document.getElementById('riskIndicator'),
    riskLabel: document.getElementById('riskLabel'),
    riskProbability: document.getElementById('riskProbability'),
    alertBox: document.getElementById('alertBox'),
    alertMessage: document.getElementById('alertMessage'),

    // Rain container
    rainContainer: document.querySelector('.rain')
};

/**
 * Rain Animation Function (Mandatory)
 */
function rain(intensity = 50) {
    if (intensity === 0) {
        elements.rainContainer.innerHTML = '';
        return;
    }

    const existingDrops = elements.rainContainer.querySelectorAll('.drop');
    const maxDrops = 50; // Fixed base number of drops

    // Intensity affects visual properties: speed (faster), opacity (more visible), size (larger)
    const intensityFactor = intensity / 100; // 0-1 range
    const speedMultiplier = 0.3 + (intensityFactor * 0.5); // Faster with higher intensity (0.3-0.8s)
    const opacityBoost = intensityFactor * 0.4; // More opaque with higher intensity (+0.4 max)
    const sizeBoost = intensityFactor * 20; // Larger drops with higher intensity (+20px max)

    // If drops don't exist, create them
    if (existingDrops.length === 0) {
        let drops = "";
        for (let i = 0; i < maxDrops; i++) {
            // Randomly distribute drops across full width (0-100%)
            const randomLeft = Math.random() * 100;

            // Store base properties first for later updates
            const baseLength = 30 + Math.random() * 40;
            const baseOpacity = 0.5 + Math.random() * 0.3;
            
            // Variation in drop properties, with intensity affecting them
            const dropSpeed = (0.3 + Math.random() * 0.4) / speedMultiplier; // Faster = more intense
            const dropLength = baseLength + sizeBoost; // Larger = more intense
            const dropOpacity = baseOpacity + opacityBoost; // More opaque = more intense (clamped to 1.0)
            const windDrift = (Math.random() - 0.5) * 20; // -10px to +10px horizontal drift
            const animationDelay = Math.random() * 0.3; // 0-0.3s delay for natural staggered appearance

            drops += `
                <div class="drop" data-base-length="${baseLength}" data-base-opacity="${baseOpacity}" style="
                    left:${randomLeft}%;
                    height:${Math.min(dropLength, 100)}px;
                    --wind-drift:${windDrift}px;
                    --drop-opacity:${Math.min(dropOpacity, 1.0)};
                    animation-delay:${animationDelay}s;
                    animation-duration:${Math.max(dropSpeed, 0.2)}s;">
                    <div class="stem"></div>
                    <div class="splat"></div>
                </div>`;
        }
        elements.rainContainer.innerHTML = drops;
    } else {
        // Update existing drops without clearing - only change visual properties that don't restart animation
        existingDrops.forEach((drop) => {
            // Get stored base properties from data attributes or recalculate
            const storedBaseLength = parseFloat(drop.dataset.baseLength) || 50;
            const storedBaseOpacity = parseFloat(drop.dataset.baseOpacity) || 0.65;
            
            // Update opacity and size based on current intensity
            const dropLength = storedBaseLength + sizeBoost;
            const dropOpacity = storedBaseOpacity + opacityBoost;
            
            // Update only visual properties, animation continues smoothly
            drop.style.setProperty('--drop-opacity', Math.min(dropOpacity, 1.0));
            drop.style.height = Math.min(dropLength, 100) + 'px';
        });
    }
}

/**
 * Update rain intensity based on slider
 */
function updateRainIntensity(rainfallValue) {
    // Scale rainfall (0-100 mm/hr) to rain drops (0-100)
    const intensity = Math.floor(rainfallValue);

    // Update immediately on every change for smooth slider response
    if (intensity !== currentRainIntensity) {
        currentRainIntensity = intensity;
        rain(intensity);
    }
}

/**
 * Initialize application
 */
function init() {
    // Set initial values
    updateAllDisplays();

    // Attach event listeners
    attachEventListeners();

    // Initial calculation
    recalculate();

    // Initial rain
    rain(currentParams.rainfallIntensity);

    console.log('EDGE Playground initialized - Real-time mode');
}

/**
 * Attach event listeners to all controls
 * Using 'input' event for real-time updates
 */
function attachEventListeners() {
    // Slope Angle - Real-time terrain deformation
    elements.slopeAngle.addEventListener('input', (e) => {
        currentParams.slopeAngle = parseFloat(e.target.value);
        elements.slopeValue.textContent = `${currentParams.slopeAngle}°`;

        // Immediate terrain update
        terrainVisualizer.updateSlope(currentParams.slopeAngle);

        // Recalculate physics
        recalculate();
    });

    // Rainfall Intensity - Real-time rain animation
    elements.rainfallIntensity.addEventListener('input', (e) => {
        currentParams.rainfallIntensity = parseFloat(e.target.value);
        elements.rainfallValue.textContent = `${currentParams.rainfallIntensity} mm/hr`;

        // Immediate rain update
        updateRainIntensity(currentParams.rainfallIntensity);

        // Recalculate physics
        recalculate();
    });

    // Rainfall Duration
    elements.rainfallDuration.addEventListener('input', (e) => {
        currentParams.rainfallDuration = parseFloat(e.target.value);
        elements.durationValue.textContent = `${currentParams.rainfallDuration.toFixed(1)} days`;
        recalculate();
    });

    // Soil Cohesion
    elements.soilCohesion.addEventListener('input', (e) => {
        currentParams.soilCohesion = parseFloat(e.target.value);
        elements.cohesionValue.textContent = `${currentParams.soilCohesion} kPa`;
        recalculate();
    });

    // Friction Angle
    elements.frictionAngle.addEventListener('input', (e) => {
        currentParams.frictionAngle = parseFloat(e.target.value);
        elements.frictionValue.textContent = `${currentParams.frictionAngle}°`;
        recalculate();
    });

    // Initial Saturation
    elements.initialSaturation.addEventListener('input', (e) => {
        currentParams.initialSaturation = parseFloat(e.target.value);
        elements.saturationValue.textContent = `${currentParams.initialSaturation}%`;
        terrainVisualizer.updateSaturation(currentParams.initialSaturation);
        recalculate();
    });

    // Reset Button
    elements.resetButton.addEventListener('click', resetToDefaults);
}

/**
 * Update all display values
 */
function updateAllDisplays() {
    elements.slopeValue.textContent = `${currentParams.slopeAngle}°`;
    elements.rainfallValue.textContent = `${currentParams.rainfallIntensity} mm/hr`;
    elements.durationValue.textContent = `${currentParams.rainfallDuration.toFixed(1)} days`;
    elements.cohesionValue.textContent = `${currentParams.soilCohesion} kPa`;
    elements.frictionValue.textContent = `${currentParams.frictionAngle}°`;
    elements.saturationValue.textContent = `${currentParams.initialSaturation}%`;

    // Update slider positions
    elements.slopeAngle.value = currentParams.slopeAngle;
    elements.rainfallIntensity.value = currentParams.rainfallIntensity;
    elements.rainfallDuration.value = currentParams.rainfallDuration;
    elements.soilCohesion.value = currentParams.soilCohesion;
    elements.frictionAngle.value = currentParams.frictionAngle;
    elements.initialSaturation.value = currentParams.initialSaturation;
}

/**
 * Recalculate all metrics (real-time)
 */
function recalculate() {
    const metrics = physicsEngine.computeMetrics(currentParams, false);
    updateMetricsDisplay(metrics);
    updateRiskDisplay(metrics);
    updateReasoningDisplay(metrics.reasoning);

    // Update visualization risk level
    terrainVisualizer.updateRisk(parseFloat(metrics.risk) / 100);
}

/**
 * Update metrics panel
 */
function updateMetricsDisplay(metrics) {
    // FoS
    elements.fosValue.textContent = metrics.fos;
    elements.fosStatus.textContent = metrics.status;
    elements.fosStatus.className = `metric-status ${metrics.statusClass}`;

    // Rainfall
    elements.rainfallLoad.textContent = metrics.rainfallLoad;
    elements.rainfallDetail.textContent =
        `${currentParams.rainfallIntensity} mm/hr for ${currentParams.rainfallDuration.toFixed(1)} days`;

    // Slope
    elements.slopeStability.textContent = metrics.slopeStability;
    elements.slopeDetail.textContent =
        `Angle: ${currentParams.slopeAngle}° (${getSlopeCategory(currentParams.slopeAngle)})`;

    // Pore water pressure
    elements.poreWaterPressure.textContent = `${metrics.poreWaterPressure} kPa`;
    elements.poreWaterDetail.textContent =
        `Saturation: ${currentParams.initialSaturation}%`;
}

/**
 * Update risk panel
 */
function updateRiskDisplay(metrics) {
    // Update risk indicator
    const riskIndicator = elements.riskIndicator;
    riskIndicator.querySelector('.risk-icon').textContent = metrics.riskIcon;
    elements.riskLabel.textContent = metrics.riskLevel;

    // Update color based on risk
    if (metrics.statusClass === 'safe') {
        riskIndicator.style.borderColor = '#38a169';
        elements.riskLabel.style.color = '#38a169';
    } else if (metrics.statusClass === 'warning') {
        riskIndicator.style.borderColor = '#d69e2e';
        elements.riskLabel.style.color = '#d69e2e';
    } else {
        riskIndicator.style.borderColor = '#e53e3e';
        elements.riskLabel.style.color = '#e53e3e';
    }

    // Update metrics
    elements.riskProbability.textContent = `${metrics.risk}%`;

    // Show/hide alert box
    if (metrics.shouldAlert) {
        elements.alertBox.style.display = 'flex';
        elements.alertMessage.textContent =
            `Slope failure condition detected. Rainfall: ${currentParams.rainfallIntensity} mm/hr over ` +
            `${currentParams.rainfallDuration.toFixed(1)} days. Slope angle: ${currentParams.slopeAngle}°. ` +
            `Factor of Safety: ${metrics.fos}. Immediate evacuation required.`;
    } else {
        elements.alertBox.style.display = 'none';
    }
}

/**
 * Update reasoning panel
 */
function updateReasoningDisplay(reasoning) {
    elements.reasoningList.innerHTML = '';
    reasoning.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        elements.reasoningList.appendChild(li);
    });
}

/**
 * Get slope category
 */
function getSlopeCategory(angle) {
    if (angle < 15) return 'Gentle';
    if (angle < 25) return 'Moderate';
    if (angle < 40) return 'Steep';
    return 'Very Steep';
}

/**
 * Reset to default values
 */
function resetToDefaults() {
    // Reset physics engine
    physicsEngine.resetSimulation();

    // Reset parameters
    currentParams = physicsEngine.getDefaults();
    updateAllDisplays();

    // Reset visualization
    terrainVisualizer.reset();
    terrainVisualizer.updateSlope(currentParams.slopeAngle);
    terrainVisualizer.updateSaturation(currentParams.initialSaturation);

    // Reset rain
    rain(currentParams.rainfallIntensity);
    currentRainIntensity = currentParams.rainfallIntensity;

    // Recalculate
    recalculate();

    // Flash status
    flashStatus('Parameters reset to defaults');
}

/**
 * Flash status message
 */
function flashStatus(message) {
    const statusText = elements.systemStatus.querySelector('.status-text');
    const originalText = statusText.textContent;

    statusText.textContent = message;

    setTimeout(() => {
        statusText.textContent = originalText;
    }, 2000);
}

/**
 * Handle keyboard shortcuts
 */
document.addEventListener('keydown', (e) => {
    // Ctrl+R: Reset to defaults
    if (e.code === 'KeyR' && e.ctrlKey) {
        e.preventDefault();
        resetToDefaults();
    }
});

/**
 * Handle window resize
 */
window.addEventListener('resize', () => {
    terrainVisualizer.resize();
});

/**
 * Initialize on DOM ready
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

/**
 * Export for debugging
 */
window.app = {
    physicsEngine,
    terrainVisualizer,
    currentParams,
    recalculate,
    rain
};
