export interface WeatherState {
  intensity: number; // 0 (dry) to 1 (lethal downpour)
  windX: number; // wind velocity
  lightningFlash: boolean;
  fogDensity: number;
}
