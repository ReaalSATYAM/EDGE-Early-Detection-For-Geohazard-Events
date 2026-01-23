/**
 * Terrain Visualization Module
 * Renders realistic 2D mountain cross-section with enhanced visual quality
 */

class TerrainVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // Animation state
        this.isAnimating = false;
        this.isPaused = false;
        this.animationFrame = null;
        this.landslideProgress = 0;
        this.landslideActive = false;

        // Terrain parameters
        this.slopeAngle = 35;
        this.riskLevel = 0;
        this.saturation = 50;
        this.particles = [];
        this.microSlips = [];

        // Enhanced color palette for realism
        this.colors = {
            // Sky gradient
            skyTop: '#0a0e1a',
            skyBottom: '#1a1f2e',

            // Soil layers - more natural earth tones
            soilLight: '#8b7355',
            soilMedium: '#6b5444',
            soilDark: '#4a3829',
            soilDeep: '#2d2318',

            // Bedrock
            bedrock: '#3a3a3a',
            bedrockHighlight: '#4a4a4a',

            // Vegetation
            grassBright: '#4a7c59',
            grassDark: '#2d5a3d',

            // Water and moisture
            water: '#4299e1',
            moisture: 'rgba(66, 153, 225, 0.3)',

            // Alerts
            danger: '#ef4444',
            warning: '#f59e0b'
        };

        this.init();
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.render();
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.render();
    }

    updateSlope(angle) {
        this.slopeAngle = angle;
        if (!this.isAnimating) {
            this.render();
        }
    }

    updateRisk(risk) {
        this.riskLevel = risk;
        if (!this.isAnimating) {
            this.render();
        }
    }

    updateSaturation(saturation) {
        this.saturation = saturation;
        if (!this.isAnimating) {
            this.render();
        }
    }

    render() {
        const { width, height } = this.canvas;
        const ctx = this.ctx;

        // Clear and draw sky gradient
        this.drawSky(ctx, width, height);

        // Draw terrain with enhanced realism
        this.drawTerrain(ctx, width, height);

        // Draw particles if animating
        if (this.isAnimating && this.landslideActive) {
            this.updateParticles();
            this.drawParticles(ctx);
        }

        // Draw risk overlay
        if (this.riskLevel > 0.5) {
            this.drawRiskOverlay(ctx, width, height);
        }

        // Draw measurements and labels
        this.drawMeasurements(ctx, width, height);
    }

    drawSky(ctx, width, height) {
        // Gradient sky for depth
        const gradient = ctx.createLinearGradient(0, 0, 0, height * 0.6);
        gradient.addColorStop(0, this.colors.skyTop);
        gradient.addColorStop(1, this.colors.skyBottom);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    drawTerrain(ctx, width, height) {
        const baseY = height * 0.75;
        const slopeRad = (this.slopeAngle * Math.PI) / 180;

        // Calculate slope geometry
        const slopeLength = width * 0.7;
        const slopeHeight = Math.tan(slopeRad) * slopeLength;

        const startX = width * 0.15;
        const startY = baseY;
        const endX = startX + slopeLength;
        const endY = startY - slopeHeight;

        // Draw bedrock base
        this.drawBedrock(ctx, startX, baseY, width, height);

        // Draw soil layers with realistic texturing
        this.drawSoilLayers(ctx, startX, startY, endX, endY, width, height);

        // Draw surface details
        if (this.riskLevel < 0.7) {
            this.drawVegetation(ctx, startX, startY, endX, endY);
            this.drawGrassLayer(ctx, startX, startY, endX, endY);
        }

        // Draw moisture indicators if saturated
        if (this.saturation > 70) {
            this.drawMoistureIndicators(ctx, startX, startY, endX, endY);
        }

        // Draw cracks and deformation
        if (this.riskLevel > 0.5) {
            this.drawCracks(ctx, startX, startY, endX, endY);
        }

        // Draw subtle shading for 3D effect
        this.drawShading(ctx, startX, startY, endX, endY, width, height);
    }

    drawBedrock(ctx, startX, baseY, width, height) {
        // Solid bedrock foundation
        const gradient = ctx.createLinearGradient(0, baseY, 0, height);
        gradient.addColorStop(0, this.colors.bedrock);
        gradient.addColorStop(1, this.colors.bedrockHighlight);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, baseY, width, height - baseY);

        // Add texture to bedrock
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * width;
            const y = baseY + Math.random() * (height - baseY);
            const size = Math.random() * 3 + 1;
            ctx.fillRect(x, y, size, size);
        }
    }

    drawSoilLayers(ctx, startX, startY, endX, endY, width, height) {
        const layers = 6; // More layers for realism
        const baseThickness = 25;

        // Calculate saturation-based darkening
        const saturationFactor = Math.max(0, Math.min(1, (this.saturation - 50) / 40));

        const slopeRad = (this.slopeAngle * Math.PI) / 180;

        for (let i = 0; i < layers; i++) {
            const layerThickness = baseThickness * (1 + i * 0.1); // Varying thickness
            const offset = i * baseThickness;
            const perpX = Math.sin(slopeRad) * offset;
            const perpY = Math.cos(slopeRad) * offset;

            // Select base color based on depth
            let baseColor;
            if (i === 0) baseColor = this.colors.soilLight;
            else if (i === 1) baseColor = this.colors.soilMedium;
            else if (i < 4) baseColor = this.colors.soilDark;
            else baseColor = this.colors.soilDeep;

            // Apply saturation darkening
            if (saturationFactor > 0) {
                const rgb = this.hexToRgb(baseColor);
                const darkenAmount = saturationFactor * 0.5;
                const r = Math.floor(rgb.r * (1 - darkenAmount));
                const g = Math.floor(rgb.g * (1 - darkenAmount));
                const b = Math.floor(rgb.b * (1 - darkenAmount));
                baseColor = `rgb(${r}, ${g}, ${b})`;
            }

            // Create gradient for depth
            const x1 = startX - perpX;
            const y1 = startY + perpY;
            const x2 = startX - perpX;
            const y2 = startY + perpY + layerThickness;

            const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
            gradient.addColorStop(0, baseColor);
            gradient.addColorStop(1, this.adjustBrightness(baseColor, -20));

            ctx.fillStyle = gradient;

            // Override with red if landslide active
            if (this.landslideActive && i < 2) {
                const alpha = this.landslideProgress * 0.4;
                ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
            }

            // Draw layer polygon
            ctx.beginPath();
            ctx.moveTo(startX - perpX, startY + perpY);
            ctx.lineTo(endX - perpX, endY + perpY);
            ctx.lineTo(endX - perpX, endY + perpY + layerThickness);
            ctx.lineTo(startX - perpX, startY + perpY + layerThickness);
            ctx.closePath();
            ctx.fill();

            // Add texture to soil
            this.addSoilTexture(ctx, startX - perpX, startY + perpY,
                endX - startX, layerThickness, i);

            // Draw layer boundary
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(startX - perpX, startY + perpY);
            ctx.lineTo(endX - perpX, endY + perpY);
            ctx.stroke();
        }
    }

    addSoilTexture(ctx, x, y, width, height, layerIndex) {
        // Add small particles/rocks for texture
        const particleCount = Math.floor(width * height / 500);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';

        for (let i = 0; i < particleCount; i++) {
            const px = x + Math.random() * width;
            const py = y + Math.random() * height;
            const size = Math.random() * 2 + 0.5;

            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Add occasional larger rocks in deeper layers
        if (layerIndex > 2) {
            const rockCount = Math.floor(Math.random() * 3);
            ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
            for (let i = 0; i < rockCount; i++) {
                const px = x + Math.random() * width;
                const py = y + Math.random() * height;
                const size = Math.random() * 4 + 2;
                ctx.beginPath();
                ctx.arc(px, py, size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    drawGrassLayer(ctx, startX, startY, endX, endY) {
        // Thin grass layer on surface
        const slopeRad = (this.slopeAngle * Math.PI) / 180;
        const grassThickness = 3;

        const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
        gradient.addColorStop(0, this.colors.grassBright);
        gradient.addColorStop(1, this.colors.grassDark);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.lineTo(endX + Math.sin(slopeRad) * grassThickness,
            endY - Math.cos(slopeRad) * grassThickness);
        ctx.lineTo(startX + Math.sin(slopeRad) * grassThickness,
            startY - Math.cos(slopeRad) * grassThickness);
        ctx.closePath();
        ctx.fill();
    }

    drawVegetation(ctx, startX, startY, endX, endY) {
        const numPlants = 20;
        const slopeRad = (this.slopeAngle * Math.PI) / 180;

        for (let i = 0; i < numPlants; i++) {
            const t = (i + Math.random() * 0.5) / numPlants;
            const x = startX + (endX - startX) * t;
            const y = startY + (endY - startY) * t;

            // Draw small plant/bush
            const plantHeight = 6 + Math.random() * 4;
            const plantWidth = 4 + Math.random() * 3;

            // Plant shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.beginPath();
            ctx.ellipse(x + 2, y + 2, plantWidth / 2, 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Plant body
            const plantGradient = ctx.createRadialGradient(x, y - plantHeight / 2, 0,
                x, y - plantHeight / 2, plantWidth);
            plantGradient.addColorStop(0, this.colors.grassBright);
            plantGradient.addColorStop(1, this.colors.grassDark);

            ctx.fillStyle = plantGradient;
            ctx.beginPath();
            ctx.ellipse(x, y - plantHeight / 2, plantWidth / 2, plantHeight / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawMoistureIndicators(ctx, startX, startY, endX, endY) {
        // Show water seepage/moisture
        const slopeRad = (this.slopeAngle * Math.PI) / 180;
        const moistureLevel = (this.saturation - 70) / 20; // 0-1 range

        // Water droplets or seepage marks
        const dropletCount = Math.floor(moistureLevel * 15);

        for (let i = 0; i < dropletCount; i++) {
            const t = Math.random();
            const x = startX + (endX - startX) * t;
            const y = startY + (endY - startY) * t;

            // Small water droplet
            ctx.fillStyle = this.colors.moisture;
            ctx.beginPath();
            ctx.arc(x, y, 2 + Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();

            // Highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(x - 0.5, y - 0.5, 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawCracks(ctx, startX, startY, endX, endY) {
        const numCracks = Math.floor(this.riskLevel * 10);
        const slopeRad = (this.slopeAngle * Math.PI) / 180;

        ctx.strokeStyle = this.colors.danger;
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 3;

        for (let i = 0; i < numCracks; i++) {
            const t = (i + 0.3 + Math.random() * 0.4) / numCracks;
            const x = startX + (endX - startX) * t;
            const y = startY + (endY - startY) * t;

            const crackLength = 25 + Math.random() * 35;
            const perpX = Math.sin(slopeRad) * crackLength;
            const perpY = Math.cos(slopeRad) * crackLength;

            // Main crack
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - perpX + (Math.random() - 0.5) * 15, y + perpY);
            ctx.stroke();

            // Branch cracks
            if (Math.random() > 0.5) {
                const branchX = x - perpX * 0.5;
                const branchY = y + perpY * 0.5;
                ctx.beginPath();
                ctx.moveTo(branchX, branchY);
                ctx.lineTo(branchX + (Math.random() - 0.5) * 10,
                    branchY + Math.random() * 15);
                ctx.stroke();
            }
        }

        ctx.shadowBlur = 0;
    }

    drawShading(ctx, startX, startY, endX, endY, width, height) {
        // Add subtle shadow for 3D depth
        const slopeRad = (this.slopeAngle * Math.PI) / 180;

        // Shadow gradient from top of slope
        const shadowGradient = ctx.createLinearGradient(
            endX, endY,
            endX + 50, endY + 50
        );
        shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.1)');
        shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = shadowGradient;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.lineTo(endX + 50, endY + 50);
        ctx.lineTo(startX + 50, startY + 50);
        ctx.closePath();
        ctx.fill();
    }

    drawRiskOverlay(ctx, width, height) {
        const alpha = (this.riskLevel - 0.5) * 0.3;
        ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.fillRect(0, 0, width, height);

        // Pulsing warning text if critical
        if (this.riskLevel > 0.75) {
            const pulse = Math.sin(Date.now() / 400) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
            ctx.font = 'bold 22px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 10;
            ctx.fillText('⚠ CRITICAL RISK ZONE ⚠', width / 2, 40);
            ctx.shadowBlur = 0;
        }
    }

    drawMeasurements(ctx, width, height) {
        const baseY = height * 0.75;
        const startX = width * 0.15;
        const slopeRad = (this.slopeAngle * Math.PI) / 180;

        // Angle arc
        const arcRadius = 70;

        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(74, 144, 226, 0.5)';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(startX, baseY, arcRadius, -slopeRad, 0);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Angle label with background
        const labelX = startX + arcRadius + 15;
        const labelY = baseY - 15;
        const labelText = `${this.slopeAngle}°`;

        ctx.font = 'bold 16px JetBrains Mono, monospace';
        const metrics = ctx.measureText(labelText);

        // Label background
        ctx.fillStyle = 'rgba(26, 31, 46, 0.9)';
        ctx.fillRect(labelX - 5, labelY - 18, metrics.width + 10, 24);

        // Label border
        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 1;
        ctx.strokeRect(labelX - 5, labelY - 18, metrics.width + 10, 24);

        // Label text
        ctx.fillStyle = '#4a90e2';
        ctx.textAlign = 'left';
        ctx.fillText(labelText, labelX, labelY);
    }

    // Particle system for landslide animation
    createParticles() {
        this.particles = [];
        const { width, height } = this.canvas;
        const baseY = height * 0.75;
        const startX = width * 0.15;
        const slopeRad = (this.slopeAngle * Math.PI) / 180;
        const slopeLength = width * 0.7;

        // Create varied particles
        for (let i = 0; i < 150; i++) {
            const t = Math.random();
            const x = startX + slopeLength * t;
            const y = baseY - Math.tan(slopeRad) * slopeLength * t;

            // Varied particle types
            const type = Math.random();
            let color, size;

            if (type < 0.3) {
                // Soil particles
                color = this.colors.soilDark;
                size = Math.random() * 3 + 2;
            } else if (type < 0.6) {
                // Medium debris
                color = this.colors.soilMedium;
                size = Math.random() * 5 + 3;
            } else {
                // Rocks
                color = this.colors.bedrock;
                size = Math.random() * 7 + 4;
            }

            this.particles.push({
                x, y,
                initialX: x,
                initialY: y,
                vx: (Math.random() - 0.5) * 3,
                vy: Math.random() * 2,
                size,
                color,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2
            });
        }
    }

    updateParticles() {
        if (!this.landslideActive) return;

        const slopeRad = (this.slopeAngle * Math.PI) / 180;
        const gravity = 0.25;
        const slopeAccelX = Math.sin(slopeRad) * gravity;
        const slopeAccelY = Math.cos(slopeRad) * gravity;

        this.particles.forEach(p => {
            p.vx += slopeAccelX;
            p.vy += slopeAccelY;
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;

            // Bounce off bottom
            if (p.y > this.canvas.height - p.size) {
                p.y = this.canvas.height - p.size;
                p.vy *= -0.4;
                p.vx *= 0.7;
            }
        });

        this.landslideProgress = Math.min(this.landslideProgress + 0.01, 1);
    }

    drawParticles(ctx) {
        this.particles.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);

            // Particle shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.arc(1, 1, p.size, 0, Math.PI * 2);
            ctx.fill();

            // Particle body
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(0, 0, p.size, 0, Math.PI * 2);
            ctx.fill();

            // Highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.beginPath();
            ctx.arc(-p.size * 0.3, -p.size * 0.3, p.size * 0.3, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        });
    }

    // Helper functions
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    adjustBrightness(color, amount) {
        const rgb = this.hexToRgb(color);
        const r = Math.max(0, Math.min(255, rgb.r + amount));
        const g = Math.max(0, Math.min(255, rgb.g + amount));
        const b = Math.max(0, Math.min(255, rgb.b + amount));
        return `rgb(${r}, ${g}, ${b})`;
    }

    // Animation controls
    startAnimation() {
        if (this.isAnimating) return;

        this.isAnimating = true;
        this.isPaused = false;

        if (this.riskLevel > 0.75) {
            this.landslideActive = true;
            this.createParticles();
        }

        this.animate();
    }

    pauseAnimation() {
        this.isPaused = true;
    }

    resumeAnimation() {
        if (this.isAnimating && this.isPaused) {
            this.isPaused = false;
            this.animate();
        }
    }

    stopAnimation() {
        this.isAnimating = false;
        this.isPaused = false;
        this.landslideActive = false;
        this.landslideProgress = 0;
        this.particles = [];

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        this.render();
    }

    animate() {
        if (!this.isAnimating || this.isPaused) return;

        this.render();
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }

    reset() {
        this.stopAnimation();
        this.slopeAngle = 35;
        this.riskLevel = 0;
        this.saturation = 50;
        this.microSlips = [];
        this.render();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TerrainVisualizer;
}
