// 交互式粒子背景 - 黑白灰极简风格
(function() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let mouse = { x: -1000, y: -1000 };
    let animationId;
    const PARTICLE_COUNT = 80;
    const CONNECTION_DIST = 150;
    const MOUSE_DIST = 200;

    function getThemePalette() {
        const isLight = document.documentElement.dataset.theme === 'light';
        return isLight
            ? {
                particle: '118, 95, 69',
                particleAccent: '94, 73, 49',
                line: '162, 136, 104',
                glow: '247, 226, 196',
                particleOpacity: 0.68,
                accentOpacity: 0.4,
                lineOpacity: 0.62,
                mouseOpacity: 0.68,
                glowOpacity: 0.16,
                lineWidth: 0.78,
                mouseLineWidth: 1.2
            }
            : {
                particle: '255, 255, 255',
                particleAccent: '255, 255, 255',
                line: '255, 255, 255',
                glow: '255, 255, 255',
                particleOpacity: 1,
                accentOpacity: 0.18,
                lineOpacity: 1,
                mouseOpacity: 1,
                glowOpacity: 0,
                lineWidth: 0.5,
                mouseLineWidth: 0.8
            };
    }

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function createParticle() {
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            radius: Math.random() * 1.25 + 0.55,
            opacity: Math.random() * 0.4 + 0.1,
            accentMix: Math.random(),
            pulse: Math.random() * Math.PI * 2
        };
    }

    function init() {
        resize();
        particles = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particles.push(createParticle());
        }
    }

    function drawParticle(p) {
        const palette = getThemePalette();
        const isLight = document.documentElement.dataset.theme === 'light';
        if (isLight) {
            const glowRadius = p.radius * 4.6;
            const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);
            glow.addColorStop(0, `rgba(${palette.glow}, ${palette.glowOpacity * (0.62 + p.accentMix * 0.28)})`);
            glow.addColorStop(1, `rgba(${palette.glow}, 0)`);
            ctx.beginPath();
            ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        const accent = p.accentMix > 0.66 ? palette.particleAccent : palette.particle;
        const opacity = p.opacity * (p.accentMix > 0.66 ? palette.accentOpacity : palette.particleOpacity);
        ctx.fillStyle = `rgba(${accent}, ${opacity})`;
        ctx.fill();
        if (isLight) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.46, p.radius * 0.5), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,248,239,${0.16 + p.opacity * 0.1})`;
            ctx.fill();
        }
    }

    function drawConnection(p1, p2, dist) {
        const palette = getThemePalette();
        const opacity = (1 - dist / CONNECTION_DIST) * 0.15 * palette.lineOpacity;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(${palette.line}, ${opacity})`;
        ctx.lineWidth = palette.lineWidth;
        ctx.stroke();
    }

    function drawMouseConnection(p, dist) {
        const palette = getThemePalette();
        const opacity = (1 - dist / MOUSE_DIST) * 0.25 * palette.mouseOpacity;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(mouse.x, mouse.y);
        const isLight = document.documentElement.dataset.theme === 'light';
        ctx.strokeStyle = `rgba(${isLight ? palette.particleAccent : palette.line}, ${opacity})`;
        ctx.lineWidth = palette.mouseLineWidth;
        ctx.stroke();
    }

    function update() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.pulse += 0.015;
            p.radius += Math.sin(p.pulse) * 0.002;

            // 边界反弹
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

            // 鼠标排斥力
            const dx = p.x - mouse.x;
            const dy = p.y - mouse.y;
            const mouseDist = Math.sqrt(dx * dx + dy * dy);
            if (mouseDist < MOUSE_DIST) {
                const force = (MOUSE_DIST - mouseDist) / MOUSE_DIST * (document.documentElement.dataset.theme === 'light' ? 0.018 : 0.02);
                if (mouseDist > 0) {
                    p.vx += dx / mouseDist * force;
                    p.vy += dy / mouseDist * force;
                }
                drawMouseConnection(p, mouseDist);
            }

            // 速度衰减
            p.vx *= 0.999;
            p.vy *= 0.999;

            drawParticle(p);

            // 粒子间连线
            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const ddx = p.x - p2.x;
                const ddy = p.y - p2.y;
                const dist = Math.sqrt(ddx * ddx + ddy * ddy);
                if (dist < CONNECTION_DIST) {
                    drawConnection(p, p2, dist);
                }
            }
        }

        animationId = requestAnimationFrame(update);
    }

    window.addEventListener('resize', () => {
        resize();
    });

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    window.addEventListener('mouseleave', () => {
        mouse.x = -1000;
        mouse.y = -1000;
    });

    init();
    update();
})();
