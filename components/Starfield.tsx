import React, { useEffect, useRef } from 'react';

const Starfield: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', resize);
    resize();

    // Stars
    const stars = Array.from({ length: 400 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5 + 0.1,
      speedY: Math.random() * 0.15 + 0.02,
      opacity: Math.random() * 0.7 + 0.3,
    }));

    // Nebula Clouds (The "Milky Way" effect)
    // Using large radial gradients moving very slowly
    const clouds = [
      { x: width * 0.2, y: height * 0.3, r: 400, color: '79, 70, 229', speedX: 0.02, speedY: 0.01 }, // Indigo
      { x: width * 0.8, y: height * 0.7, r: 500, color: '147, 51, 234', speedX: -0.01, speedY: -0.02 }, // Purple
      { x: width * 0.5, y: height * 0.5, r: 600, color: '30, 58, 138', speedX: 0.01, speedY: 0.01 }, // Dark Blue
      { x: width * 0.1, y: height * 0.9, r: 300, color: '236, 72, 153', speedX: 0.02, speedY: -0.01 }, // Pink
    ];

    let frameId: number;

    const animate = () => {
      // Clear with transparency to allow trails? No, strict repaint for crispness.
      // We use a very dark base to simulate space.
      ctx.fillStyle = '#020617'; // bg-gray-950 hex
      ctx.fillRect(0, 0, width, height);

      // Draw Nebula Clouds
      clouds.forEach(cloud => {
        cloud.x += cloud.speedX;
        cloud.y += cloud.speedY;

        // Bounce off walls effectively or wrap? Let's just oscillate slightly or wrap large
        // Simple wrap for continuous flow
        if (cloud.x > width + cloud.r) cloud.x = -cloud.r;
        if (cloud.x < -cloud.r) cloud.x = width + cloud.r;
        if (cloud.y > height + cloud.r) cloud.y = -cloud.r;
        if (cloud.y < -cloud.r) cloud.y = height + cloud.r;

        const g = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.r);
        g.addColorStop(0, `rgba(${cloud.color}, 0.08)`); // Very faint
        g.addColorStop(0.5, `rgba(${cloud.color}, 0.03)`);
        g.addColorStop(1, `rgba(${cloud.color}, 0)`);
        
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height); // Fill whole screen with the gradient composite? 
        // Actually fillRect is faster than arc for screen-filling gradients but arc is more accurate for "blobs"
        // Let's stick to drawing the blob rect area or just full screen if they are huge.
        // Drawing specific rect is better performance-wise if possible, but let's just do full screen composite for smooth blending.
        // Wait, multiple fillRects might be heavy. Let's just draw the circle.
        
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, cloud.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Stars
      ctx.fillStyle = '#ffffff';
      stars.forEach(star => {
        star.y -= star.speedY;
        if (star.y < 0) {
          star.y = height;
          star.x = Math.random() * width;
        }

        ctx.globalAlpha = star.opacity;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      frameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 w-full h-full pointer-events-none -z-10"
      style={{ background: '#020617' }} 
    />
  );
};

export default Starfield;