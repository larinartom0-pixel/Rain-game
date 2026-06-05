import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, RefreshCw, Sparkles, Volume2, VolumeX, HelpCircle, Move, Zap } from 'lucide-react';
import { soundEngine } from './RainWorldSynth';

interface OutskirtsLocationProps {
  onBack: () => void;
  isSoundMuted: boolean;
  toggleSound: () => void;
}

// Simple physics dimensions
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 580;

interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'concrete' | 'metal' | 'pipe';
  label?: string;
}

interface ClimbPole {
  x: number;
  yMin: number;
  yMax: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  color: string;
}

interface WormGrass {
  x: number;
  height: number;
  phase: number;
  swaySpeed: number;
}

export default function OutskirtsLocation({ onBack, isSoundMuted, toggleSound }: OutskirtsLocationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Controls state (both touch/button held and keyboard)
  const [controls, setControls] = useState({
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
  });

  const controlsRef = useRef(controls);
  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  // Extra aesthetic states
  const [spawnNotification, setSpawnNotification] = useState(true);
  const [showGuide, setShowGuide] = useState(true);
  const [lastAction, setLastAction] = useState<string>('Слимакокіт готовий!');

  // Define collision platforms matching the user's provided screen layout
  const platforms: Platform[] = [
    // Ground floor
    { x: 0, y: 520, w: 1000, h: 60, type: 'concrete', label: 'Окраїни' },
    
    // Middle Left Platform Pillars/Shelves (as in the screenshot)
    { x: 30, y: 400, w: 110, h: 18, type: 'metal' },
    { x: 20, y: 280, w: 110, h: 18, type: 'metal' },
    { x: 30, y: 160, w: 110, h: 18, type: 'metal' },

    // Middle/Right Monolith Slabs
    { x: 230, y: 310, w: 85, h: 210, type: 'concrete', label: '히' },
    { x: 440, y: 310, w: 85, h: 210, type: 'concrete', label: '어' },
    { x: 555, y: 280, w: 85, h: 240, type: 'concrete', label: 'F' },
    { x: 790, y: 380, w: 90, h: 140, type: 'concrete', label: 'ㄷ' },

    // Top suspended girders & bridges
    { x: 330, y: 140, w: 460, h: 16, type: 'pipe' },
    { x: 840, y: 180, w: 160, h: 18, type: 'metal' }
  ];

  // Vertical Climbing Poles (allow vertical navigation)
  const poles: ClimbPole[] = [
    { x: 160, yMin: 140, yMax: 520 },  // Left pole near metal structures
    { x: 355, yMin: 20, yMax: 520 },   // Tall central-left pole
    { x: 480, yMin: 140, yMax: 520 },  // Center pole on the monolith
    { x: 597, yMin: 10, yMax: 520 },   // Tall central-right pole
    { x: 730, yMin: 40, yMax: 520 },   // Right structural vertical bar
    { x: 920, yMin: 180, yMax: 520 }   // Far right bar
  ];

  // Trigger manual lightning for visual joy
  const [isFlashing, setIsFlashing] = useState(false);
  const handleLightningStrike = () => {
    setIsFlashing(true);
    if (!isSoundMuted) {
      soundEngine.playThunder();
    }
    setLastAction('Гроза вдарила по руїнах!');
    setTimeout(() => {
      setIsFlashing(false);
    }, 150 + Math.random() * 150);
  };

  // Setup game loop, physics updates and drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    // Player Physics State
    const player = {
      x: 200,
      y: 400,
      vx: 0,
      vy: 0,
      width: 24,
      height: 38,
      isGrounded: false,
      isClimbing: false,
      climbPoleX: 0,
      
      // Authentic Rain World Procedural Skeleton
      head: { x: 200, y: 380, vx: 0, vy: 0 },
      chest: { x: 200, y: 395, vx: 0, vy: 0 },
      hips: { x: 200, y: 410, vx: 0, vy: 0 },
      
      // Procanim elements: Trail of past coordinates (for tail sway)
      tail: Array.from({ length: 8 }, (_, i) => ({ x: 200, y: 410 + i * 6 })),
      facingRight: true,
      earSway: 0,
      crouching: false,
    };

    // Spawn green glowing worm grass elements along the ground
    const wormGrasses: WormGrass[] = [];
    for (let x = 10; x < CANVAS_WIDTH; x += 15) {
      // Exclude pillars footprint for realism
      const onPillar1 = x >= 220 && x <= 320;
      const onPillar2 = x >= 430 && x <= 530;
      const onPillar3 = x >= 545 && x <= 650;
      const onPillar4 = x >= 780 && x <= 890;
      if (!onPillar1 && !onPillar2 && !onPillar3 && !onPillar4) {
        wormGrasses.push({
          x,
          height: 12 + Math.random() * 20,
          phase: Math.random() * Math.PI * 2,
          swaySpeed: 0.03 + Math.random() * 0.04
        });
      }
    }

    // Dynamic storm raindrops
    const particles: Particle[] = [];
    for (let i = 0; i < 48; i++) {
      particles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        vx: -1.2 - Math.random() * 1.5, // Blown by wind
        vy: 10 + Math.random() * 8,
        length: 8 + Math.random() * 12,
        color: `rgba(130, 140, 160, ${0.15 + Math.random() * 0.2})`
      });
    }

    // Key handlers to support standard computer setups seamlessly
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent scrolling
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      const key = e.key.toLowerCase();
      if (e.key === 'ArrowLeft' || key === 'a') {
        setControls(prev => ({ ...prev, left: true }));
      }
      if (e.key === 'ArrowRight' || key === 'd') {
        setControls(prev => ({ ...prev, right: true }));
      }
      if (e.key === 'ArrowUp' || key === 'w') {
        setControls(prev => ({ ...prev, up: true }));
      }
      if (e.key === 'ArrowDown' || key === 's') {
        setControls(prev => ({ ...prev, down: true }));
      }
      if (e.key === ' ' || key === 'z') {
        setControls(prev => ({ ...prev, jump: true }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (e.key === 'ArrowLeft' || key === 'a') {
        setControls(prev => ({ ...prev, left: false }));
      }
      if (e.key === 'ArrowRight' || key === 'd') {
        setControls(prev => ({ ...prev, right: false }));
      }
      if (e.key === 'ArrowUp' || key === 'w') {
        setControls(prev => ({ ...prev, up: false }));
      }
      if (e.key === 'ArrowDown' || key === 's') {
        setControls(prev => ({ ...prev, down: false }));
      }
      if (e.key === ' ' || key === 'z') {
        setControls(prev => ({ ...prev, jump: false }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Main animation loop
    const tick = () => {
      t += 0.05;
      const ctrl = controlsRef.current;

      // ---------------- Physics Updates ----------------
      
      // Determine if player is touching or near any climbing pole.
      // We check relative to the center of the slugcat for high accuracy.
      let touchingPole: ClimbPole | null = null;
      for (const p of poles) {
        const horizontalDist = Math.abs((player.x + player.width / 2) - p.x);
        // Generous vertical segment and horizontal range (24px) for highly comfortable snapping
        if (horizontalDist < 24 && player.y + player.height >= p.yMin - 15 && player.y <= p.yMax + 15) {
          touchingPole = p;
          break;
        }
      }

      // Smooth Grabbing pole state transition with automatic snap
      if (touchingPole) {
        if (ctrl.up || ctrl.down) {
          if (!player.isClimbing) {
            player.isClimbing = true;
            player.x = touchingPole.x - player.width / 2; // snap perfectly centered
            player.vx = 0;
            player.vy = 0;
            setLastAction('Карабкається по жердині // Climbing');
          }
        }
      } else {
        player.isClimbing = false;
      }

      // Handle climbing locomotion vs default walking locomotion
      if (player.isClimbing && touchingPole) {
        // Smoothly snap x alignment to pole center
        player.x += ((touchingPole.x - player.width / 2) - player.x) * 0.35;

        // Fast responsive vertical climb controls
        if (ctrl.up) {
          player.y -= 4.4; // super responsive climb
          player.facingRight = true;
          if (player.y < touchingPole.yMin) player.y = touchingPole.yMin;
        } else if (ctrl.down) {
          player.y += 4.4;
          if (player.y > touchingPole.yMax - player.height) {
            player.y = touchingPole.yMax - player.height;
            player.isClimbing = false; // drop down to the ground
          }
        }

        // Drop from pole immediately if pressing Left or Right without climbing (highly convenient!)
        if (ctrl.left && !ctrl.up && !ctrl.down) {
          player.isClimbing = false;
          player.vx = -3.2;
          player.facingRight = false;
          setLastAction('Зліз із жердини ліворуч');
        } else if (ctrl.right && !ctrl.up && !ctrl.down) {
          player.isClimbing = false;
          player.vx = 3.2;
          player.facingRight = true;
          setLastAction('Зліз із жердини праворуч');
        }

        // Jump to hop off the pole dynamically as a leap!
        if (ctrl.jump) {
          player.isClimbing = false;
          player.vy = -8.5; // robust jump height
          if (ctrl.left) {
            player.vx = -6.0;
            player.facingRight = false;
          } else if (ctrl.right) {
            player.vx = 6.0;
            player.facingRight = true;
          } else {
            player.vx = player.facingRight ? 3.5 : -3.5;
          }
          setLastAction('Стрибок з жердини!');
          if (!isSoundMuted) {
            soundEngine.playThunder(); 
          }
        }
      } else {
        // Normal horizontal walking controls
        const accel = 0.55;
        const maxWalkSpeed = player.crouching ? 2.0 : 4.8;
        const friction = 0.82;

        if (ctrl.left) {
          player.vx -= accel;
          player.facingRight = false;
          player.crouching = ctrl.down;
        } else if (ctrl.right) {
          player.vx += accel;
          player.facingRight = true;
          player.crouching = ctrl.down;
        } else {
          player.vx *= friction;
        }

        // If holding down, crouch
        if (ctrl.down && player.isGrounded) {
          player.crouching = true;
        } else if (!ctrl.down) {
          player.crouching = false;
        }

        // Clamp walk velocity
        if (player.vx > maxWalkSpeed) player.vx = maxWalkSpeed;
        if (player.vx < -maxWalkSpeed) player.vx = -maxWalkSpeed;

        // Apply gravity if airborn
        if (!player.isGrounded) {
          player.vy += 0.38; // gravity index
          const maxFallSpeed = 12;
          if (player.vy > maxFallSpeed) player.vy = maxFallSpeed;
        }

        // Normal Jump action from ground
        if (ctrl.jump && player.isGrounded) {
          player.vy = -8.5;
          player.isGrounded = false;
          setLastAction('Класичний стрибок Слимакокота!');
          if (!isSoundMuted) {
            soundEngine.playThunder();
          }
        }

        // Update coordinates
        player.x += player.vx;
        player.y += player.vy;

        // Simple Platform Collision boundaries
        player.isGrounded = false;
        
        for (const plat of platforms) {
          // Check horizontal intersections
          const xIntersect = player.x + player.width > plat.x && player.x < plat.x + plat.w;
          if (xIntersect) {
            // Check top collision (standing)
            const wasAbove = (player.y + player.height - player.vy) <= plat.y + 4;
            const isInside = player.y + player.height >= plat.y && player.y < plat.y + plat.h;
            
            if (wasAbove && isInside && player.vy >= 0) {
              player.y = plat.y - player.height;
              player.vy = 0;
              player.isGrounded = true;
            }
            
            // Underneath ceiling landing
            const wasBelow = (player.y - player.vy) >= plat.y + plat.h - 4;
            const isInsideCeil = player.y < plat.y + plat.h && player.y + player.height > plat.y;
            if (wasBelow && isInsideCeil && player.vy < 0) {
              player.y = plat.y + plat.h;
              player.vy = 0.1;
            }
          }
        }

        // Left/Right Stage borders
        if (player.x < 10) {
          player.x = 10;
          player.vx = 0;
        }
        if (player.x > CANVAS_WIDTH - player.width - 10) {
          player.x = CANVAS_WIDTH - player.width - 10;
          player.vx = 0;
        }
      }

      // ---------------- Procedural Skeleton Physics (Active IK) ----------------
      const targetHeadX = player.x + player.width / 2 + (player.vx * 1.5);
      const targetHeadY = player.y + 6 + (player.vy * 0.4) + (player.crouching ? 8 : 0);

      // Spring head toward target
      player.head.x += (targetHeadX - player.head.x) * 0.45;
      player.head.y += (targetHeadY - player.head.y) * 0.45;

      // The chest trails the head with organic walking/wiggling movements!
      const walkWobbleX = player.isGrounded && Math.abs(player.vx) > 0.4 ? Math.sin(t * 1.8) * 4.2 : 0;
      const walkWobbleY = player.isGrounded && Math.abs(player.vx) > 0.4 ? Math.abs(Math.cos(t * 1.8)) * 2 : 0;
      
      const targetChestX = player.head.x - (player.facingRight ? 4 : -4) + walkWobbleX;
      const targetChestY = player.head.y + 12 + (player.crouching ? 4 : 0) + walkWobbleY;
      player.chest.x += (targetChestX - player.chest.x) * 0.35;
      player.chest.y += (targetChestY - player.chest.y) * 0.35;

      // Hips trail the chest with beautiful sine wave sway
      const targetHipsX = player.chest.x - (player.facingRight ? 8 : -8) + (player.isClimbing ? Math.sin(t * 1.5) * 3 : 0);
      const targetHipsY = player.chest.y + 14 + (player.crouching ? -2 : 0);
      player.hips.x += (targetHipsX - player.hips.x) * 0.3;
      player.hips.y += (targetHipsY - player.hips.y) * 0.3;

      // Procedural tail chain physics (hips drag segments)
      player.tail[0] = { x: player.hips.x, y: player.hips.y };
      for (let i = 1; i < player.tail.length; i++) {
        const prev = player.tail[i - 1];
        const curr = player.tail[i];
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // Slightly lengthen segments during fast motions for elastic stretch feel
        const speedFactor = Math.min(Math.sqrt(player.vx*player.vx + player.vy*player.vy), 8);
        const segmentLength = 5.2 + (speedFactor * 0.15); 
        
        if (dist > segmentLength) {
          const ratio = segmentLength / dist;
          curr.x = prev.x + dx * ratio;
          curr.y = prev.y + dy * ratio + 0.4; // pull tail downward gently with gravity
        }

        // Apply automatic secondary wavy wiggle down the spine chain when moving
        if (player.isGrounded && Math.abs(player.vx) > 0.4) {
          curr.x += Math.sin(t * 1.2 - i * 0.6) * 0.7 * (i * 0.4);
        }
      }

      // Wind drag / ear feedback sway
      player.earSway = Math.sin(t * 1.5) * 2.5 + (player.vx * -0.7);

      // ---------------- Drawing & Rendering ----------------
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 1. Storm sky background and depth fog gradients
      ctx.fillStyle = '#1c1822'; // Outskirts storm dark background color
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Lightning storm dynamic flash overlay
      if (isFlashing) {
        ctx.fillStyle = 'rgba(235, 240, 255, 0.45)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      // Draw distant layers: faint mountains, towers, and rusty wire netting
      ctx.strokeStyle = '#2b2434';
      ctx.lineWidth = 1.0;
      
      // Horizontal wires drooping down visually (as in screenshots)
      for (let yLevel = 60; yLevel < 400; yLevel += 90) {
        ctx.beginPath();
        ctx.moveTo(0, yLevel);
        ctx.quadraticCurveTo(CANVAS_WIDTH / 2, yLevel + 45, CANVAS_WIDTH, yLevel - 15);
        ctx.stroke();
      }

      // Distant industrial girders silhouetted in the haze
      ctx.fillStyle = '#221d2a';
      ctx.fillRect(100, 80, 50, CANVAS_HEIGHT - 80);
      ctx.fillRect(700, 40, 60, CANVAS_HEIGHT - 40);

      // Faint background block drawings
      ctx.fillStyle = '#262030';
      ctx.fillRect(360, 200, 280, 100); // distant wall girder
      ctx.strokeStyle = '#32293e';
      ctx.lineWidth = 4;
      ctx.strokeRect(360, 200, 280, 100);

      // 2. Render Climbing Poles (Pipes/Rebars) with beautiful rusty accents
      poles.forEach((pole) => {
        // Main pole core
        ctx.strokeStyle = '#0e0b12';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(pole.x, pole.yMin);
        ctx.lineTo(pole.x, pole.yMax);
        ctx.stroke();

        ctx.strokeStyle = '#4e3a30'; // Rust highlighted core
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(pole.x, pole.yMin);
        ctx.lineTo(pole.x, pole.yMax);
        ctx.stroke();

        // Horizontal bolts and notches on the rebars
        ctx.strokeStyle = '#1a141b';
        ctx.lineWidth = 3;
        for (let py = pole.yMin + 20; py < pole.yMax; py += 35) {
          ctx.beginPath();
          ctx.moveTo(pole.x - 5, py);
          ctx.lineTo(pole.x + 5, py);
          ctx.stroke();
        }
      });

      // 3. Draw All Geometric Platforms & Ancient Monoliths with Custom Glyphs
      platforms.forEach((plat) => {
        if (plat.type === 'concrete') {
          // Outskirts thick brutalist stone structure
          ctx.fillStyle = '#14111a'; // absolute dark front monoliths
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          
          // Subtle ancient weathered brick frame
          ctx.strokeStyle = '#34292d';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

          // Render Glyphs ('히', '어', 'F' etc) inside the pillars
          if (plat.label) {
            ctx.fillStyle = 'rgba(245, 245, 255, 0.75)'; // soft white glyph light
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 8;
            ctx.font = 'bold 36px font-sans';
            ctx.textAlign = 'center';
            ctx.fillText(plat.label, plat.x + plat.w / 2, plat.y + 60);
            
            // Clear shadow modifiers
            ctx.shadowBlur = 0;
          }

          // Distant rusted chain links hanging if specified
          ctx.strokeStyle = '#2d2228';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(plat.x, plat.y);
          ctx.quadraticCurveTo(plat.x + plat.w/2, plat.y + 20, plat.x + plat.w, plat.y);
          ctx.stroke();

        } else if (plat.type === 'metal') {
          // Left side hanging rusted platforms
          ctx.fillStyle = '#22120e'; // RUST metal look
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          
          // Outer lining border
          ctx.strokeStyle = '#44251f';
          ctx.lineWidth = 3;
          ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

          // Diagonal structural truss marks
          ctx.strokeStyle = '#120704';
          ctx.lineWidth = 1.5;
          for (let step = plat.x + 10; step < plat.x + plat.w; step += 20) {
            ctx.beginPath();
            ctx.moveTo(step, plat.y);
            ctx.lineTo(step + 10, plat.y + plat.h);
            ctx.stroke();
          }

        } else if (plat.type === 'pipe') {
          // Horizontal metal piping bridge
          ctx.fillStyle = '#1c1514';
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          ctx.strokeStyle = '#3a2b29';
          ctx.lineWidth = 2;
          ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

          // Pipe flange ridges
          ctx.fillStyle = '#2e201e';
          for (let rx = plat.x + 30; rx < plat.x + plat.w; rx += 80) {
            ctx.fillRect(rx, plat.y - 2, 8, plat.h + 4);
          }
        }
      });

      // 4. Glow Grass (Worm Grass) along the bottom dirt
      ctx.strokeStyle = '#12411e'; // deep plant outline
      ctx.lineWidth = 2.0;
      wormGrasses.forEach((grass) => {
        // Sway calculation based on index and time
        const sway = Math.sin(t * grass.swaySpeed + grass.phase) * 6;
        
        ctx.beginPath();
        ctx.moveTo(grass.x, 520); // starts at ground block
        ctx.quadraticCurveTo(
          grass.x + sway * 0.4, 
          520 - grass.height * 0.5, 
          grass.x + sway, 
          520 - grass.height
        );
        ctx.stroke();

        // Little green neon seed/eye glowing light at the top of the worm grass stem!
        ctx.fillStyle = '#22c55e'; // neon green glow
        ctx.beginPath();
        ctx.arc(grass.x + sway, 520 - grass.height, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      // 5. Render THE SLUGCAT CHARACTER (Organic Soft-Body Procedurally Animated!)
      ctx.save();
      
      // Face direction mirroring multiplier
      const dirSign = player.facingRight ? 1 : -1;

      // Draw the Procedural Tail Chain first (renders behind the body slugcat)
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < player.tail.length; i++) {
        const seg = player.tail[i];
        const prev = player.tail[i - 1];
        
        // Soft coral-to-peach gradient down the tail segments
        const tailGrad = ctx.createLinearGradient(prev.x, prev.y, seg.x, seg.y);
        tailGrad.addColorStop(0, '#fda4af'); // rose base
        tailGrad.addColorStop(1, '#fca5a5'); // soft warm peach blush tip
        
        ctx.strokeStyle = tailGrad;
        // Tail tapers to a point
        const thickness = 13.5 - (i * 1.5); 
        ctx.lineWidth = Math.max(thickness, 1.5);
        
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(seg.x, seg.y);
        ctx.stroke();

        // Subtle dark outline on the tail elements for depth
        ctx.strokeStyle = 'rgba(156, 102, 85, 0.12)';
        ctx.lineWidth = Math.max(thickness + 1.2, 2.5);
        ctx.stroke();
      }

      // Linear warm skin color gradient to paint Slugcat's body (matches reference image perfectly!)
      const slugGrad = ctx.createLinearGradient(
        player.head.x, player.head.y - 10,
        player.hips.x, player.hips.y + 12
      );
      slugGrad.addColorStop(0, '#fef08a'); // yellow cream top head/ears
      slugGrad.addColorStop(0.4, '#faf0db'); // beautiful creamy middle body
      slugGrad.addColorStop(1, '#fca5a5'); // soft coral-peach at base of hips

      ctx.fillStyle = slugGrad;
      ctx.strokeStyle = '#855140'; // weathered organic dark brick-brown outline
      ctx.lineWidth = 1.3;

      // 1. Draw procedural limbs (Feet/Arms) based on walking or climbing speed
      // Feets
      if (player.isGrounded) {
        const feetY = player.hips.y + 11.5;
        ctx.fillStyle = '#faf0db';
        ctx.strokeStyle = '#855140';
        ctx.lineWidth = 1.2;

        // Left Foot
        ctx.beginPath();
        ctx.ellipse(player.hips.x - 7, feetY, 4.5, 2.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Right Foot
        ctx.beginPath();
        ctx.ellipse(player.hips.x + 7, feetY, 4.5, 2.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Arms / Hands
      if (player.isClimbing) {
        // Gripping arms wrapped hugging the poles
        ctx.strokeStyle = '#faf0db';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(player.chest.x - 5, player.chest.y - 4);
        ctx.quadraticCurveTo(player.chest.x + (dirSign * 14), player.chest.y - 9, player.chest.x + (dirSign * 8), player.chest.y + 1);
        ctx.stroke();

        ctx.strokeStyle = '#855140';
        ctx.lineWidth = 1.0;
        ctx.stroke();
      } else {
        // Swinging running arms or relaxed idle arms
        const armSwing = Math.abs(player.vx) > 0.4 ? Math.sin(t * 2.0) * 4 : 0;
        ctx.strokeStyle = '#faf0db';
        ctx.lineWidth = 3.0;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(player.chest.x - 4, player.chest.y + 1);
        ctx.lineTo(player.chest.x - 9 + armSwing, player.chest.y + 7 + (player.vy * 0.4));
        ctx.moveTo(player.chest.x + 4, player.chest.y + 1);
        ctx.lineTo(player.chest.x + 9 - armSwing, player.chest.y + 7 + (player.vy * 0.4));
        ctx.stroke();
      }

      // 2. Draw Organically Connected Soft Body Blobs (Hips, Chest, Head)
      const headRad = 10.0;
      const chestRad = 11.6;
      const hipsRad = 12.8;

      // Draw Hips blob
      ctx.fillStyle = slugGrad;
      ctx.beginPath();
      ctx.arc(player.hips.x, player.hips.y, hipsRad, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw Chest blob
      ctx.beginPath();
      ctx.arc(player.chest.x, player.chest.y, chestRad, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw Head blob
      ctx.beginPath();
      ctx.arc(player.head.x, player.head.y, headRad, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Fill bridging hulls to unify the skeleton into a beautiful single fluid slug creature!
      ctx.beginPath();
      ctx.moveTo(player.head.x - headRad, player.head.y);
      ctx.lineTo(player.chest.x - chestRad, player.chest.y);
      ctx.lineTo(player.hips.x - hipsRad, player.hips.y);
      ctx.lineTo(player.hips.x + hipsRad, player.hips.y);
      ctx.lineTo(player.chest.x + chestRad, player.chest.y);
      ctx.lineTo(player.head.x + headRad, player.head.y);
      ctx.closePath();
      ctx.fillStyle = slugGrad;
      ctx.fill();

      // Draw smooth edge contours
      ctx.strokeStyle = '#855140';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(player.head.x - headRad, player.head.y);
      ctx.lineTo(player.chest.x - chestRad, player.chest.y);
      ctx.lineTo(player.hips.x - hipsRad, player.hips.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(player.head.x + headRad, player.head.y);
      ctx.lineTo(player.chest.x + chestRad, player.chest.y);
      ctx.lineTo(player.hips.x + hipsRad, player.hips.y);
      ctx.stroke();

      // 3. Draw Long Floppy Rounded Ears
      const earLeftX = player.head.x - 4.8;
      const earLeftY = player.head.y - 7;
      const earRightX = player.head.x + 4.8;
      const earRightY = player.head.y - 7;

      ctx.fillStyle = '#fef08a'; // yellow cream top for the ears
      ctx.strokeStyle = '#855140';
      ctx.lineWidth = 1.3;

      // Left Ear (thick, soft, tapering)
      ctx.save();
      ctx.translate(earLeftX, earLeftY);
      const earAngLeft = -0.15 + (player.earSway * 0.05);
      ctx.beginPath();
      ctx.ellipse(0, -9, 4.4, 11.5, earAngLeft, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Right Ear
      ctx.save();
      ctx.translate(earRightX, earRightY);
      const earAngRight = 0.15 + (player.earSway * 0.05);
      ctx.beginPath();
      ctx.ellipse(0, -9, 4.4, 11.5, earAngRight, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 4. Face Features: Deep hollow beady vertical eyes & tiny dash nose (Matches illustration perfectly!)
      const faceX = player.head.x + (dirSign * 4.5);
      const faceY = player.head.y - 1.2;

      ctx.fillStyle = '#0f0b12'; // deep pitch ink-black

      // Left vertical hollow oval eye (expressive hollow look)
      ctx.beginPath();
      ctx.ellipse(faceX - 3.2, faceY, 2.5, 4.8, 0.05 * dirSign, 0, Math.PI * 2);
      ctx.fill();

      // Right vertical hollow oval eye
      ctx.beginPath();
      ctx.ellipse(faceX + 3.2, faceY, 2.5, 4.8, -0.05 * dirSign, 0, Math.PI * 2);
      ctx.fill();

      // Tiny cute horizontal dash nose right between the big vertical eyes
      ctx.strokeStyle = '#0f0b12';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(faceX - 0.8, faceY + 4.2);
      ctx.lineTo(faceX + 0.8, faceY + 4.2);
      ctx.stroke();

      ctx.restore();

      // 6. Draw storm raindrops falling overlapping everything
      ctx.lineWidth = 1.0;
      particles.forEach((p) => {
        ctx.strokeStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 1.5, p.y + p.vy);
        ctx.stroke();

        // Increment position
        p.x += p.vx;
        p.y += p.vy;

        // Reset particle on cross boundary edge
        if (p.y > CANVAS_HEIGHT || p.x < 0) {
          p.y = -20;
          p.x = Math.random() * CANVAS_WIDTH;
        }
      });

      // Frame recurse
      animId = requestAnimationFrame(tick);
    };

    tick();

    // Clean up bounds
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSoundMuted, isFlashing]);

  // Touch action button handlers
  const handlePress = (btn: 'left' | 'right' | 'up' | 'down' | 'jump', isPressed: boolean) => {
    setControls(prev => ({ ...prev, [btn]: isPressed }));
  };

  return (
    <div className="absolute inset-0 bg-[#0c0a10] z-40 flex flex-col items-center justify-between font-sans text-slate-100 overflow-hidden">
      
      {/* HUD: Ambient Top Control Bar */}
      <div className="w-full flex items-center justify-between p-4 z-50 bg-gradient-to-b from-black/85 to-transparent">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg border border-zinc-800 bg-zinc-950/80 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all cursor-pointer flex items-center gap-2 text-xs font-mono tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" />
            МЕНЮ
          </button>

          <div className="hidden sm:flex flex-col text-left font-mono text-[9px]">
            <span className="text-amber-500 font-bold tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              ОКРАЇНИ // INDUSTRIAL WASTELAND
            </span>
            <span className="text-zinc-500">ПРОЦЕДУРНИЙ РЕНДЕР ТА ФІЗИКА SLUGCAT</span>
          </div>
        </div>

        {/* Diagnostic log indicator */}
        <div className="px-3 py-1.5 rounded border border-zinc-800/40 bg-zinc-950/60 text-[10px] font-mono text-zinc-400 max-w-xs truncate">
          <span className="text-green-500 animate-pulse mr-1">●</span> {lastAction}
        </div>

        <div className="flex items-center gap-2">
          {/* Quick trigger for thunder */}
          <button
            onClick={handleLightningStrike}
            className="p-2 rounded-lg border border-yellow-800/40 bg-yellow-950/20 text-yellow-500 hover:bg-yellow-800 hover:text-white transition-all cursor-pointer flex items-center gap-1 text-xs"
            title="Грозовий удар"
          >
            <Zap className="w-4 h-4" />
          </button>

          <button
            onClick={toggleSound}
            className="p-2 rounded-lg border border-zinc-800 bg-zinc-950/80 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            {isSoundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-amber-500" />}
          </button>
        </div>
      </div>

      {/* Main interactive viewport block scaled to fit nicely */}
      <div className="relative flex-1 w-full max-w-5xl h-full flex items-center justify-center p-2 sm:p-4">
        
        {/* Soft framing vignette */}
        <div className="absolute inset-0 pointer-events-none border border-zinc-900/10 rounded-2xl z-20 shadow-[inset_0_0_80px_rgba(0,0,0,0.85)]" />
        
        {/* Core Canvas stage layout */}
        <div className="relative w-full aspect-[1000/580] max-h-[75vh] bg-black rounded-lg sm:rounded-2xl overflow-hidden border border-zinc-800/30 shadow-2xl">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full h-full object-contain"
          />

          {/* Intro dynamic overlay message badge */}
          <AnimatePresence>
            {spawnNotification && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-6 left-1/2 -translate-x-1/2 z-30 bg-black/90 border border-amber-800/40 px-5 py-3 rounded-xl text-center shadow-xl font-sans"
              >
                <span className="text-xs uppercase tracking-[0.2em] text-amber-500 block font-bold mb-1">
                  СЛИМАКОКІТ СПАВНИВСЯ !
                </span>
                <span className="text-[10px] text-zinc-400 block max-w-xs leading-normal">
                  Керуйте ним на екрані або за допомогою кнопок {`←`} {`→`} JUMP {`↑`} {`↓`} та досліджуйте зруйноване індустріальне лігво.
                </span>
                <button
                  onClick={() => setSpawnNotification(false)}
                  className="mt-2 text-[9px] font-mono font-bold tracking-widest text-slate-100 bg-amber-950/40 border border-amber-800/30 px-3 py-1 rounded hover:bg-amber-500 hover:text-black transition-all cursor-pointer"
                >
                  OK // ЗРОЗУМІЛО
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* SCREEN CONTROLS SECTION: 
          - LEFT side: Left and Right buttons
          - RIGHT side: Jump, Climb Up, Climb Down buttons
      */}
      <div className="w-full w-max-5xl grid grid-cols-2 gap-4 px-6 pb-6 pt-2 z-40 select-none pointer-events-none">
        
        {/* LEFT COMPARTMENT: HORIZONTAL WALK BUTTONS (← and →) */}
        <div className="flex items-center justify-start gap-4 pointer-events-auto">
          {/* MOVE LEFT BUTTON */}
          <button
            id="touch-ctrl-left"
            onTouchStart={() => handlePress('left', true)}
            onTouchEnd={() => handlePress('left', false)}
            onMouseDown={() => handlePress('left', true)}
            onMouseUp={() => handlePress('left', false)}
            onMouseLeave={() => handlePress('left', false)}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zinc-950/70 hover:bg-zinc-900 border-2 border-zinc-800 hover:border-amber-500/80 flex items-center justify-center text-white active:scale-90 select-none shadow-xl cursor-pointer transition-all duration-150"
          >
            <span className="text-3xl font-bold">←</span>
          </button>

          {/* MOVE RIGHT BUTTON */}
          <button
            id="touch-ctrl-right"
            onTouchStart={() => handlePress('right', true)}
            onTouchEnd={() => handlePress('right', false)}
            onMouseDown={() => handlePress('right', true)}
            onMouseUp={() => handlePress('right', false)}
            onMouseLeave={() => handlePress('right', false)}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zinc-950/70 hover:bg-zinc-900 border-2 border-zinc-800 hover:border-amber-500/80 flex items-center justify-center text-white active:scale-90 select-none shadow-xl cursor-pointer transition-all duration-150"
          >
            <span className="text-3xl font-bold">→</span>
          </button>
        </div>

        {/* RIGHT COMPARTMENT: ACTION BUTTONS (Jump, Up ↑, Down ↓) */}
        <div className="flex items-center justify-end gap-3.5 sm:gap-4 pointer-events-auto">
          {/* CLIMB UP / POLE GRAB BUTTON */}
          <button
            id="touch-ctrl-up"
            onTouchStart={() => handlePress('up', true)}
            onTouchEnd={() => handlePress('up', false)}
            onMouseDown={() => handlePress('up', true)}
            onMouseUp={() => handlePress('up', false)}
            onMouseLeave={() => handlePress('up', false)}
            className="w-13 h-13 sm:w-16 sm:h-16 rounded-full bg-zinc-950/70 hover:bg-zinc-900 border-2 border-zinc-800 hover:border-amber-500/80 flex items-center justify-center text-white active:scale-90 select-none shadow-xl cursor-pointer transition-all duration-150"
            title="Піднятися вгору / Схопитися"
          >
            <span className="text-2xl font-bold">↑</span>
          </button>

          {/* CLIMB DOWN / CROUCH BUTTON */}
          <button
            id="touch-ctrl-down"
            onTouchStart={() => handlePress('down', true)}
            onTouchEnd={() => handlePress('down', false)}
            onMouseDown={() => handlePress('down', true)}
            onMouseUp={() => handlePress('down', false)}
            onMouseLeave={() => handlePress('down', false)}
            className="w-13 h-13 sm:w-16 sm:h-16 rounded-full bg-zinc-950/70 hover:bg-zinc-900 border-2 border-zinc-800 hover:border-amber-500/80 flex items-center justify-center text-white active:scale-90 select-none shadow-xl cursor-pointer transition-all duration-150"
            title="Спуститися вниз / Присісти"
          >
            <span className="text-2xl font-bold">↓</span>
          </button>

          {/* GIANT JUMP ACTION BUTTON */}
          <button
            id="touch-ctrl-jump"
            onTouchStart={() => handlePress('jump', true)}
            onTouchEnd={() => handlePress('jump', false)}
            onMouseDown={() => handlePress('jump', true)}
            onMouseUp={() => handlePress('jump', false)}
            onMouseLeave={() => handlePress('jump', false)}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-950/50 hover:bg-amber-900/60 border-2 border-amber-600/80 hover:border-amber-400 flex flex-col items-center justify-center text-amber-300 hover:text-white active:scale-90 select-none shadow-xl cursor-pointer transition-all duration-150 font-mono tracking-widest text-[9px] font-bold"
          >
            <span className="text-xl sm:text-2xl font-sans mb-[-2px]">▲</span>
            JUMP
          </button>
        </div>

      </div>

      {/* Persistent little tips banner on keyboard alternatives */}
      <div className="hidden md:block text-[9px] font-mono text-zinc-600 uppercase tracking-widest pb-4 select-none">
        Альтернативно: Рухайтеся на WASD або стрілочках, стрибок на ПРОБІЛ або Z
      </div>

    </div>
  );
}
