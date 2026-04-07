'use client';

import { useEffect, useState, useCallback } from 'react';
import Particles from '@tsparticles/react';
import { getParticlesEngine } from '../lib/particlesEngine';

let engineBooted = false;

export function AmbientParticles() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getParticlesEngine().then(() => setReady(true));
  }, []);

  const onLoaded = useCallback(async () => {}, []);

  if (!ready) return null;

  return (
    <Particles
      id="ambient-bg"
      options={{
        fullScreen: { enable: false },
        background: { color: { value: 'transparent' } },
        fpsLimit: 60,
        detectRetina: true,

        // ── Lớp 1: Bụi vàng huyền bí trôi nổi ──────────────────────────────
        particles: {
          number: { value: 55, density: { enable: true } },
          color: { value: ['#ffd700', '#ffcc44', '#fff0b0', '#ffa040', '#ffe8a0'] },
          shape: { type: ['circle', 'star'] },
          opacity: {
            value: { min: 0.05, max: 0.45 },
            animation: { enable: true, speed: 0.6, sync: false },
          },
          size: {
            value: { min: 1, max: 5 },
            animation: { enable: true, speed: 1.5, sync: false },
          },
          move: {
            enable: true,
            speed: { min: 0.3, max: 1.2 },
            direction: 'top',
            random: true,
            straight: false,
            outModes: { default: 'out' },
            gravity: { enable: false },
          },
          twinkle: {
            particles: { enable: true, frequency: 0.08, opacity: 0.8 },
          },
        },

        // ── Emitter riêng: Sao băng từ góc phải đi sang trái ────────────────
        emitters: [
          {
            position: { x: 110, y: 20 },
            rate: { delay: 4, quantity: 1 },
            particles: {
              number: { value: 1 },
              color: { value: '#ffffff' },
              shape: { type: 'circle' },
              size: { value: 2 },
              opacity: {
                value: 1,
                animation: { enable: true, speed: 2, startValue: 'max', destroy: 'min' },
              },
              move: {
                enable: true,
                speed: { min: 18, max: 30 },
                direction: 'bottom-left',
                straight: true,
                outModes: { default: 'destroy' },
                trail: { enable: true, length: 18, fill: { color: '#ffffff' } },
              },
              life: { count: 1, duration: { value: 1.5 } },
            },
          },
          {
            position: { x: 90, y: 5 },
            rate: { delay: 7, quantity: 1 },
            particles: {
              number: { value: 1 },
              color: { value: '#ffeeaa' },
              shape: { type: 'circle' },
              size: { value: 1.5 },
              opacity: {
                value: 1,
                animation: { enable: true, speed: 2, startValue: 'max', destroy: 'min' },
              },
              move: {
                enable: true,
                speed: { min: 15, max: 22 },
                direction: 'bottom-left',
                straight: true,
                outModes: { default: 'destroy' },
                trail: { enable: true, length: 12, fill: { color: '#ffe080' } },
              },
              life: { count: 1, duration: { value: 1.8 } },
            },
          },
          // Sparkle lẻ tẻ từ dưới bay lên (giống phù du huyền bí)
          {
            position: { x: 50, y: 100 },
            rate: { delay: 0.4, quantity: 1 },
            particles: {
              color: { value: ['#cc88ff', '#8844ff', '#ffaaff', '#ffffff', '#ffd700'] },
              shape: { type: 'star' },
              size: { value: { min: 2, max: 6 } },
              opacity: {
                value: { min: 0.2, max: 0.8 },
                animation: { enable: true, speed: 1.2, startValue: 'random', destroy: 'min' },
              },
              move: {
                enable: true,
                speed: { min: 0.5, max: 2 },
                direction: 'top',
                random: true,
                straight: false,
                outModes: { default: 'destroy' },
              },
              twinkle: { particles: { enable: true, frequency: 0.15, opacity: 1 } },
              life: { count: 1, duration: { value: { min: 3, max: 8 } } },
            },
          },
        ],
      } as any}
      particlesLoaded={onLoaded}
      style={{
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}
