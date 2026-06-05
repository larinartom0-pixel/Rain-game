/**
 * Procedural Audio Synthesizer for Rain Game in the style of Rain World.
 * Generates rain soundscapes, thunder, and melancholic ambient tracks.
 */

class RainWorldSynth {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = true;
  
  // Audio Nodes
  private masterGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  
  // Sequence trackers
  private melodyInterval: any = null;
  private droneOscillators: OscillatorNode[] = [];
  private droneGains: GainNode[] = [];
  
  constructor() {
    // Lazy initialisation on first user action
  }

  public init() {
    if (this.ctx) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
      
      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Create Rain noise
      this.setupRainSynth();
      
      // Create Ambient Drone Player
      this.setupAmbientDrone();

      this.isMuted = false;
    } catch (e) {
      console.error('Failed to initialize RainWorldSynth:', e);
    }
  }

  private setupRainSynth() {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    // Generate pinkish-brownish rain noise
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Filter towards brown noise for rumble
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 4.5; // Amplify
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    // Filters for rain depth
    this.rainFilter = this.ctx.createBiquadFilter();
    this.rainFilter.type = 'lowpass';
    this.rainFilter.frequency.setValueAtTime(450, this.ctx.currentTime);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    // Dynamic bandpass to simulate wind howling/sweeps
    const windSweep = this.ctx.createBiquadFilter();
    windSweep.type = 'peaking';
    windSweep.frequency.setValueAtTime(300, this.ctx.currentTime);
    windSweep.Q.setValueAtTime(1.5, this.ctx.currentTime);
    windSweep.gain.setValueAtTime(5, this.ctx.currentTime);

    // Connect rain nodes
    noiseSource.connect(windSweep);
    windSweep.connect(this.rainFilter);
    this.rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);

    noiseSource.start(0);

    // Start subtle wind sweeping LFO
    this.modulateWind(windSweep);
  }

  private modulateWind(filter: BiquadFilterNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(0.04, this.ctx.currentTime); // very slow sweep
    
    oscGain.gain.setValueAtTime(120, this.ctx.currentTime); // sweep width
    
    osc.connect(oscGain);
    oscGain.connect(filter.frequency);
    
    osc.start(0);
  }

  private setupAmbientDrone() {
    if (!this.ctx || !this.masterGain) return;

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    this.droneGain.connect(this.masterGain);

    // We will play a looping dark chord progression (Cm9 -> Abmaj7 -> Fm -> Gsus)
    // Dynamic synth tracks
    const chords = [
      [130.81, 164.81, 196.00, 246.94], // C3, E3, G3, B3 (CMaj7)
      [110.00, 138.59, 164.81, 220.00], // A2, C#3, E3, A3 (AMin/Maj variant)
      [116.54, 138.59, 174.61, 233.08], // A#2, C#3, F3, A#3
      [97.99, 130.81, 155.56, 196.00]   // G2, C3, D#3, G3
    ];

    let progressionIndex = 0;

    const playChord = (frequencies: number[]) => {
      if (!this.ctx || !this.droneGain || this.isMuted) return;

      const now = this.ctx.currentTime;
      
      // Stop previous
      this.droneOscillators.forEach((osc, idx) => {
        try {
          const gain = this.droneGains[idx];
          if (gain) {
            gain.gain.setValueAtTime(gain.gain.value, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 3);
          }
          osc.stop(now + 3.2);
        } catch(e){}
      });

      this.droneOscillators = [];
      this.droneGains = [];

      frequencies.forEach((freq) => {
        if (!this.ctx || !this.droneGain) return;

        // Custom rich waves
        const osc = this.ctx.createOscillator();
        const gNode = this.ctx.createGain();
        
        osc.type = Math.random() > 0.4 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        // Add low frequency detuning for analogue drift
        const detuneOsc = this.ctx.createOscillator();
        const detuneGain = this.ctx.createGain();
        detuneOsc.frequency.setValueAtTime(0.1, this.ctx.currentTime);
        detuneGain.gain.setValueAtTime(Math.random() * 8 + 4, this.ctx.currentTime);
        detuneOsc.connect(detuneGain);
        detuneGain.connect(osc.detune);
        detuneOsc.start();

        gNode.gain.setValueAtTime(0, this.ctx.currentTime);
        // Slow attack
        gNode.gain.linearRampToValueAtTime(0.04, this.ctx.currentTime + 3.5);

        // Lowpass filter for warm, dark sound
        const toneFilter = this.ctx.createBiquadFilter();
        toneFilter.type = 'lowpass';
        toneFilter.frequency.setValueAtTime(freq * 1.8, this.ctx.currentTime);

        osc.connect(toneFilter);
        toneFilter.connect(gNode);
        gNode.connect(this.droneGain);

        osc.start(0);

        this.droneOscillators.push(osc);
        this.droneGains.push(gNode);
      });
    };

    // Play first chord
    playChord(chords[0]);

    // Loop progressions every 8 seconds
    this.melodyInterval = setInterval(() => {
      progressionIndex = (progressionIndex + 1) % chords.length;
      playChord(chords[progressionIndex]);
    }, 8500);
  }

  public playThunder() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;

    // 1. Bass Rumble (Oscillator)
    const rumbleOsc = this.ctx.createOscillator();
    const rumbleGain = this.ctx.createGain();
    const rumbleFilter = this.ctx.createBiquadFilter();

    rumbleOsc.type = 'triangle';
    rumbleOsc.frequency.setValueAtTime(45, now);
    rumbleOsc.frequency.exponentialRampToValueAtTime(30, now + 4.0);

    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.setValueAtTime(80, now);

    rumbleGain.gain.setValueAtTime(0.0, now);
    rumbleGain.gain.linearRampToValueAtTime(0.4, now + 0.1); // Sudden impact
    rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.5); // long decay

    rumbleOsc.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);

    rumbleOsc.start(now);
    rumbleOsc.stop(now + 4.6);

    // 2. Crackle (Highpassed short noise blast)
    const bufferSize = 0.5 * this.ctx.sampleRate; // half second buffer
    const crashBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = crashBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const crackSource = this.ctx.createBufferSource();
    crackSource.buffer = crashBuffer;

    const crackFilter = this.ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.setValueAtTime(2500, now);
    crackFilter.Q.setValueAtTime(1.0, now);

    const crackGain = this.ctx.createGain();
    crackGain.gain.setValueAtTime(0.0, now);
    crackGain.gain.linearRampToValueAtTime(0.12, now + 0.02);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    crackSource.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(this.masterGain);

    crackSource.start(now);
    crackSource.stop(now + 0.7);
  }

  public setRainIntensity(intensity: number) {
    if (!this.ctx || !this.rainFilter || !this.rainGain) return;
    const now = this.ctx.currentTime;
    
    // Scale filter cutoff and volume according to rain intensity
    const targetFreq = 200 + (intensity * 600);
    const targetGain = 0.02 + (intensity * 0.15);

    this.rainFilter.frequency.setValueAtTime(this.rainFilter.frequency.value, now);
    this.rainFilter.frequency.exponentialRampToValueAtTime(targetFreq, now + 1.5);

    this.rainGain.gain.setValueAtTime(this.rainGain.gain.value, now);
    this.rainGain.gain.linearRampToValueAtTime(targetGain, now + 1.5);
  }

  public toggleMute(mutedState?: boolean) {
    const newState = mutedState !== undefined ? mutedState : !this.isMuted;
    this.isMuted = newState;

    if (!this.ctx) {
      this.init();
    }

    if (this.ctx && this.masterGain) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      const now = this.ctx.currentTime;
      this.masterGain.gain.linearRampToValueAtTime(newState ? 0 : 0.25, now + 0.5);
    }

    return this.isMuted;
  }

  public getMuted() {
    return this.isMuted;
  }

  public stopAll() {
    if (this.melodyInterval) {
      clearInterval(this.melodyInterval);
    }
    
    this.droneOscillators.forEach((osc) => {
      try { osc.stop(); } catch(e){}
    });
    
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

export const soundEngine = new RainWorldSynth();
