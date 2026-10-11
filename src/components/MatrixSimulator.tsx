import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, Sparkles, Sun, CloudRain, 
  CloudLightning, CloudSnow, Wind, HelpCircle, 
  WifiOff, ArrowRight
} from 'lucide-react';
import { 
  WIDTH, HEIGHT, renderMatrixFrame, 
  WeatherType, FrameState 
} from '../utils/matrixEngine';

export const MatrixSimulator: React.FC = () => {
  // Simulator state
  const [displayTime, setDisplayTime] = useState('14:35');
  const [useRealTime, setUseRealTime] = useState(true);
  const [weatherTemp, setWeatherTemp] = useState('+22°');
  const [weather, setWeather] = useState<WeatherType>('Clear');
  const [scrollText, setScrollText] = useState('Юра: Станция 32x16 ESP32 online! Привет!');
  const [isMusicMode, setIsMusicMode] = useState(false);
  const [userSpeedVal, setUserSpeedVal] = useState(50);
  const [colorClock, setColorClock] = useState('Green');
  const [colorText, setColorText] = useState('Cyan');
  const [colorWeather, setColorWeather] = useState('Yellow');
  const [autoBrightness, setAutoBrightness] = useState(true);
  const [manualBrightness, setManualBrightness] = useState(80);
  const [rawLdrValue, setRawLdrValue] = useState(2400); // 0..4095
  const [filteredLdr, setFilteredLdr] = useState(2400);
  const [isWifiConnected, setIsWifiConnected] = useState(true);
  const [isMqttConnected, setIsMqttConnected] = useState(true);
  
  // Visual effects
  const [ledStyle, setLedStyle] = useState<'round' | 'square'>('round');
  const [ledGlow, setLedGlow] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);

  // OTA simulation mode
  const [isOtaSimActive, setIsOtaSimActive] = useState(false);
  const [otaProgress, setOtaProgress] = useState(0);
  const [otaStatus, setOtaStatus] = useState<'downloading' | 'writing' | 'success' | 'error'>('downloading');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollXRef = useRef(WIDTH);
  const lastScrollTimeRef = useRef(performance.now());

  // Automatic real-time clock tick if enabled
  useEffect(() => {
    if (!useRealTime) return;
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      setDisplayTime(`${h}:${m}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [useRealTime]);

  // Exponential moving average filter for LDR (exact formula from main.cpp)
  useEffect(() => {
    if (!autoBrightness) return;
    const interval = setInterval(() => {
      setFilteredLdr(prev => Math.round((prev * 7 + rawLdrValue) / 8));
    }, 100);
    return () => clearInterval(interval);
  }, [rawLdrValue, autoBrightness]);

  // OTA progress simulation loop
  useEffect(() => {
    if (!isOtaSimActive) return;
    setOtaProgress(0);
    setOtaStatus('downloading');

    let current = 0;
    const timer = setInterval(() => {
      current += Math.floor(Math.random() * 8) + 4;
      if (current >= 100) {
        current = 100;
        setOtaProgress(100);
        setOtaStatus('success');
        clearInterval(timer);
        setTimeout(() => {
          setIsOtaSimActive(false);
        }, 3000);
      } else {
        setOtaProgress(current);
        if (current > 70) {
          setOtaStatus('writing');
        }
      }
    }, 180);

    return () => clearInterval(timer);
  }, [isOtaSimActive]);

  // Main rendering animation loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const now = performance.now();
      const canvas = canvasRef.current;

      // Scroll speed calculation: map(userSpeedVal, 0, 100, 200, 10)
      const scrollDelay = 200 - Math.round((userSpeedVal / 100) * 190);

      if (isPlaying && isMusicMode && !isOtaSimActive) {
        if (now - lastScrollTimeRef.current >= scrollDelay) {
          lastScrollTimeRef.current = now;
          scrollXRef.current -= 1;
          const textWidth = Array.from(scrollText).length * 6;
          if (scrollXRef.current < -textWidth) {
            scrollXRef.current = WIDTH;
          }
        }
      }

      // Calculate brightness
      let currentBrightness = manualBrightness;
      if (autoBrightness) {
        currentBrightness = Math.round(10 + (filteredLdr / 4095) * (255 - 10));
      }

      const frameState: FrameState = {
        displayTime,
        weatherTemp,
        weather,
        scrollText,
        scrollX: scrollXRef.current,
        isMusicMode,
        colorClock,
        colorText,
        colorWeather,
        isWifiConnected,
        isMqttConnected,
        brightness: Math.min(255, Math.max(10, currentBrightness)),
        timeMs: now,
        isOtaMode: isOtaSimActive,
        otaProgress,
        otaStatus,
      };

      const pixelBuffer = renderMatrixFrame(frameState);

      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const pixelSize = 22;
          const gap = 3;
          const widthPx = WIDTH * (pixelSize + gap) + gap;
          const heightPx = HEIGHT * (pixelSize + gap) + gap;

          if (canvas.width !== widthPx || canvas.height !== heightPx) {
            canvas.width = widthPx;
            canvas.height = heightPx;
          }

          // Background matrix chassis
          ctx.fillStyle = '#0a0d12';
          ctx.fillRect(0, 0, widthPx, heightPx);

          // Render each LED (32 cols x 16 rows)
          for (let x = 0; x < WIDTH; x++) {
            for (let y = 0; y < HEIGHT; y++) {
              // Serpentine mapping XY(x, y)
              const idx = (x & 1) === 0 ? x * HEIGHT + y : x * HEIGHT + (HEIGHT - 1 - y);
              const color = pixelBuffer[idx] || { r: 0, g: 0, b: 0 };

              const px = gap + x * (pixelSize + gap);
              const py = gap + y * (pixelSize + gap);
              const isLit = color.r > 5 || color.g > 5 || color.b > 5;

              // LED cup socket (off state)
              ctx.fillStyle = isLit ? '#121922' : '#0e1319';
              if (ledStyle === 'round') {
                ctx.beginPath();
                ctx.arc(px + pixelSize / 2, py + pixelSize / 2, pixelSize / 2, 0, Math.PI * 2);
                ctx.fill();
              } else {
                ctx.fillRect(px, py, pixelSize, pixelSize);
              }

              // Glow halo if LED is lit
              if (isLit && ledGlow) {
                const glowGradient = ctx.createRadialGradient(
                  px + pixelSize / 2,
                  py + pixelSize / 2,
                  2,
                  px + pixelSize / 2,
                  py + pixelSize / 2,
                  pixelSize * 1.2
                );
                glowGradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`);
                glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = glowGradient;
                ctx.beginPath();
                ctx.arc(px + pixelSize / 2, py + pixelSize / 2, pixelSize * 1.2, 0, Math.PI * 2);
                ctx.fill();
              }

              // Lit LED body
              if (isLit) {
                ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
                if (ledStyle === 'round') {
                  ctx.beginPath();
                  ctx.arc(px + pixelSize / 2, py + pixelSize / 2, pixelSize / 2 - 1.5, 0, Math.PI * 2);
                  ctx.fill();

                  // Subtle specular highlight on LED dome
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                  ctx.beginPath();
                  ctx.arc(px + pixelSize / 2 - 2, py + pixelSize / 2 - 2, 2.5, 0, Math.PI * 2);
                  ctx.fill();
                } else {
                  ctx.fillRect(px + 1, py + 1, pixelSize - 2, pixelSize - 2);
                }
              }
            }
          }

          // Optional subtle grid lines
          if (showGrid) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 1;
            for (let x = 0; x <= WIDTH; x++) {
              const lineX = gap + x * (pixelSize + gap) - gap / 2;
              ctx.beginPath();
              ctx.moveTo(lineX, 0);
              ctx.lineTo(lineX, heightPx);
              ctx.stroke();
            }
            for (let y = 0; y <= HEIGHT; y++) {
              const lineY = gap + y * (pixelSize + gap) - gap / 2;
              ctx.beginPath();
              ctx.moveTo(0, lineY);
              ctx.lineTo(widthPx, lineY);
              ctx.stroke();
            }
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    displayTime, weatherTemp, weather, scrollText, isMusicMode, userSpeedVal,
    colorClock, colorText, colorWeather, autoBrightness, manualBrightness,
    filteredLdr, isWifiConnected, isMqttConnected, ledStyle, ledGlow, showGrid,
    isPlaying, isOtaSimActive, otaProgress, otaStatus
  ]);

  const weatherIcons: Record<WeatherType, React.ReactNode> = {
    Clear: <Sun className="w-4 h-4 text-amber-400" />,
    Clouds: <Wind className="w-4 h-4 text-slate-300" />,
    Rain: <CloudRain className="w-4 h-4 text-blue-400" />,
    Snow: <CloudSnow className="w-4 h-4 text-cyan-200" />,
    Thunder: <CloudLightning className="w-4 h-4 text-yellow-300" />,
    Fog: <Wind className="w-4 h-4 text-slate-400" />,
    Unknown: <HelpCircle className="w-4 h-4 text-slate-500" />,
  };

  const colors = [
    { name: 'Green', label: 'Зеленый', hex: '#00ff00' },
    { name: 'Cyan', label: 'Голубой', hex: '#00ffff' },
    { name: 'Yellow', label: 'Желтый', hex: '#ffe600' },
    { name: 'Red', label: 'Красный', hex: '#ff0000' },
    { name: 'Blue', label: 'Синий', hex: '#1e78ff' },
    { name: 'Purple', label: 'Фиолетовый', hex: '#b432ff' },
    { name: 'White', label: 'Белый', hex: '#ffffff' },
    { name: 'Orange', label: 'Оранжевый', hex: '#ff8c00' },
    { name: 'Pink', label: 'Розовый', hex: '#ff1493' },
  ];

  return (
    <div className="space-y-8">
      {/* Top Description Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Интерактивный эмулятор матрицы WS2812 32×16
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Точная эмуляция C++ кода прошивки: зигзаг змейки XY(x, y), шрифт RusFont.h, погодные эффекты и GitHub OTA.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-700"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isPlaying ? 'Пауза' : 'Воспроизведение'}</span>
          </button>

          <button
            onClick={() => {
              scrollXRef.current = WIDTH;
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-700"
            title="Сброс позиции строки"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Сброс строки</span>
          </button>

          <button
            onClick={() => setIsOtaSimActive(true)}
            disabled={isOtaSimActive}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer border ${
              isOtaSimActive
                ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-500'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isOtaSimActive ? 'OTA активно...' : 'Тест экрана OTA'}</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport Container */}
      <div className="bg-[#080b0f] p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden">
        {/* Hardware Frame & Matte Display Bezel */}
        <div className="relative mx-auto flex flex-col items-center">
          <div className="p-3 sm:p-4 bg-[#0d1218] rounded-xl border border-slate-700/80 shadow-inner max-w-full overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg shadow-2xl block mx-auto"
              style={{
                maxWidth: '100%',
                height: 'auto',
                boxShadow: ledGlow ? '0 0 35px rgba(0, 255, 120, 0.08)' : 'none',
              }}
            />
          </div>

          {/* Matrix Chassis Hardware Badge */}
          <div className="mt-3 flex items-center justify-between w-full max-w-2xl px-2 text-xs text-slate-500 font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500/80" />
              <span>ESP32-WROOM-32 · GPIO 18 · 512 LEDs</span>
            </div>
            <div className="flex items-center gap-3">
              <span>Zigzag: (x & 1) ? x*16+(15-y) : x*16+y</span>
              <span className="text-slate-400 font-semibold">
                Яркость: {autoBrightness ? Math.round(10 + (filteredLdr / 4095) * 245) : manualBrightness}/255
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Mode & Content */}
        <div className="bg-[#0f141c] p-5 rounded-xl border border-slate-800 space-y-4">
          <h2 className="text-sm font-semibold text-white tracking-tight flex items-center justify-between">
            <span>Режим и контент матрицы</span>
            <span className="text-xs text-slate-400 font-normal">Строка 1: Часы / Строка 2: Инфо</span>
          </h2>

          {/* Mode Switcher */}
          <div>
            <label className="text-xs text-slate-400 block mb-1.5 font-medium">Основной режим экрана</label>
            <div className="grid grid-cols-2 gap-2 bg-[#090d13] p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setIsMusicMode(false)}
                className={`py-2 px-3 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  !isMusicMode
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Погода + Время
              </button>
              <button
                onClick={() => setIsMusicMode(true)}
                className={`py-2 px-3 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  isMusicMode
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Бегущая строка
              </button>
            </div>
          </div>

          {/* Time Controls */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-400 font-medium">Время на часах (NTP)</label>
              <button
                onClick={() => setUseRealTime(!useRealTime)}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer"
              >
                {useRealTime ? 'Синхронизировано с ПК' : 'Ручной ввод'}
              </button>
            </div>
            <input
              type="text"
              value={displayTime}
              onChange={(e) => {
                setUseRealTime(false);
                setDisplayTime(e.target.value);
              }}
              className="w-full bg-[#0a0d13] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
              placeholder="12:34"
              maxLength={8}
            />
          </div>

          {/* Weather controls (if weather mode) */}
          {!isMusicMode ? (
            <div className="space-y-3 pt-1 border-t border-slate-800/60">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Погода</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Clear', 'Clouds', 'Rain', 'Snow', 'Thunder', 'Fog'] as WeatherType[]).map((w) => (
                    <button
                      key={w}
                      onClick={() => setWeather(w)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                        weather === w
                          ? 'bg-slate-800 text-white border-emerald-500/50 shadow-sm'
                          : 'bg-[#0a0d13] text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {weatherIcons[w]}
                      <span>{w}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Температура</label>
                <input
                  type="text"
                  value={weatherTemp}
                  onChange={(e) => setWeatherTemp(e.target.value)}
                  className="w-full bg-[#0a0d13] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
                  placeholder="+22°"
                  maxLength={6}
                />
              </div>
            </div>
          ) : (
            /* Running text controls */
            <div className="space-y-3 pt-1 border-t border-slate-800/60">
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">
                  Текст бегущей строки (поддерживает кириллицу)
                </label>
                <textarea
                  value={scrollText}
                  onChange={(e) => setScrollText(e.target.value)}
                  rows={2}
                  className="w-full bg-[#0a0d13] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none resize-none"
                  placeholder="Введите текст..."
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 font-medium">Скорость скролла (userSpeedVal)</span>
                  <span className="text-slate-300 font-mono">{userSpeedVal}% ({200 - Math.round((userSpeedVal / 100) * 190)} ms)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={userSpeedVal}
                  onChange={(e) => setUserSpeedVal(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* Column 2: Brightness & Sensor Simulation */}
        <div className="bg-[#0f141c] p-5 rounded-xl border border-slate-800 space-y-4">
          <h2 className="text-sm font-semibold text-white tracking-tight">
            Датчик света (LDR) и автояркость
          </h2>

          {/* Auto vs Manual toggle */}
          <div className="flex items-center justify-between p-3 bg-[#0a0d13] rounded-lg border border-slate-800">
            <div>
              <div className="text-xs font-semibold text-white">Режим автояркости</div>
              <div className="text-[11px] text-slate-400">Экспоненциальный фильтр LDR (7:1)</div>
            </div>
            <button
              onClick={() => setAutoBrightness(!autoBrightness)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                autoBrightness ? 'bg-emerald-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoBrightness ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* LDR sensor slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">Освещенность фоторезистора (ADC)</span>
              <span className="text-slate-300 font-mono">{rawLdrValue} / 4095</span>
            </div>
            <input
              type="range"
              min="0"
              max="4095"
              step="50"
              value={rawLdrValue}
              onChange={(e) => setRawLdrValue(Number(e.target.value))}
              disabled={!autoBrightness}
              className="w-full accent-emerald-500 cursor-pointer disabled:opacity-40"
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Тьма (ночь)</span>
              <span>Комната</span>
              <span>Яркое солнце</span>
            </div>
          </div>

          {/* Manual brightness slider */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">Ручная яркость (FastLED)</span>
              <span className="text-slate-300 font-mono">{manualBrightness} / 255</span>
            </div>
            <input
              type="range"
              min="10"
              max="255"
              value={manualBrightness}
              onChange={(e) => {
                setAutoBrightness(false);
                setManualBrightness(Number(e.target.value));
              }}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Filter Calculation Breakdown */}
          <div className="p-3 bg-[#0a0d13] rounded-lg border border-slate-800/80 text-[11px] space-y-1.5 text-slate-400 font-mono">
            <div className="text-slate-300 font-semibold flex items-center gap-1.5">
              <span>Расчет FastLED:</span>
              <ArrowRight className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">
                {autoBrightness ? Math.round(10 + (filteredLdr / 4095) * 245) : manualBrightness} / 255
              </span>
            </div>
            <div>filteredLight = (prev * 7 + raw) / 8 = {filteredLdr}</div>
            <div>deadband: 6 | max_step: 4 (плавный переход)</div>
          </div>

          {/* Network alert simulations */}
          <div className="space-y-2 pt-2 border-t border-slate-800/60">
            <label className="text-xs text-slate-400 block font-medium">Тест аварийных индикаторов</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setIsWifiConnected(!isWifiConnected)}
                className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  !isWifiConnected
                    ? 'bg-red-950/80 text-red-300 border-red-800'
                    : 'bg-[#0a0d13] text-slate-400 border-slate-800'
                }`}
              >
                <WifiOff className="w-3.5 h-3.5 text-red-400" />
                <span>{!isWifiConnected ? 'WiFi потерян!' : 'WiFi подключен'}</span>
              </button>

              <button
                onClick={() => setIsMqttConnected(!isMqttConnected)}
                className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  !isMqttConnected
                    ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                    : 'bg-[#0a0d13] text-slate-400 border-slate-800'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>{!isMqttConnected ? 'MQTT потерян!' : 'MQTT подключен'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Column 3: Color Customization & Matrix Style */}
        <div className="bg-[#0f141c] p-5 rounded-xl border border-slate-800 space-y-4">
          <h2 className="text-sm font-semibold text-white tracking-tight">
            Цветовые палитры и рендер LED
          </h2>

          {/* Color pickers */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-medium">Цвет часов (Time)</label>
              <div className="flex flex-wrap gap-1.5">
                {colors.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setColorClock(c.name)}
                    className={`w-6 h-6 rounded-md border transition-transform cursor-pointer ${
                      colorClock === c.name ? 'scale-110 ring-2 ring-white/60 border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1 font-medium">Цвет бегущей строки (Text)</label>
              <div className="flex flex-wrap gap-1.5">
                {colors.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setColorText(c.name)}
                    className={`w-6 h-6 rounded-md border transition-transform cursor-pointer ${
                      colorText === c.name ? 'scale-110 ring-2 ring-white/60 border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1 font-medium">Цвет температуры (Weather)</label>
              <div className="flex flex-wrap gap-1.5">
                {colors.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setColorWeather(c.name)}
                    className={`w-6 h-6 rounded-md border transition-transform cursor-pointer ${
                      colorWeather === c.name ? 'scale-110 ring-2 ring-white/60 border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Matrix rendering options */}
          <div className="space-y-2 pt-3 border-t border-slate-800/60">
            <label className="text-xs text-slate-400 block font-medium">Внешний вид симулятора</label>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Форма диода</span>
              <div className="flex gap-1 bg-[#090d13] p-0.5 rounded-lg border border-slate-800">
                <button
                  onClick={() => setLedStyle('round')}
                  className={`px-2 py-1 rounded text-xs cursor-pointer ${
                    ledStyle === 'round' ? 'bg-slate-800 text-white' : 'text-slate-400'
                  }`}
                >
                  Круглый
                </button>
                <button
                  onClick={() => setLedStyle('square')}
                  className={`px-2 py-1 rounded text-xs cursor-pointer ${
                    ledStyle === 'square' ? 'bg-slate-800 text-white' : 'text-slate-400'
                  }`}
                >
                  Квадрат
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Свечение ореола (Glow)</span>
              <button
                onClick={() => setLedGlow(!ledGlow)}
                className={`px-2 py-1 rounded border text-xs cursor-pointer ${
                  ledGlow ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {ledGlow ? 'Включено' : 'Выключено'}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Сетка пикселей</span>
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`px-2 py-1 rounded border text-xs cursor-pointer ${
                  showGrid ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
              >
                {showGrid ? 'Показывать' : 'Скрыть'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
