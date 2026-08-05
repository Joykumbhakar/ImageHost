'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Search, 
  Calculator, 
  Terminal, 
  Mail, 
  StickyNote, 
  Compass, 
  Music, 
  Calendar 
} from 'lucide-react';

// Custom Photos Icon to perfectly match the Apple HIG overlapping shapes screenshot
const PhotosIcon = ({ size, appearance, tintColor }: { size: number, appearance: string, tintColor: string }) => {
  const petals = [
    { color: '#FF2D55', rot: 0 },
    { color: '#FF3B30', rot: 45 },
    { color: '#FF9500', rot: 90 },
    { color: '#FFCC00', rot: 135 },
    { color: '#4CD964', rot: 180 },
    { color: '#5AC8FA', rot: 225 },
    { color: '#007AFF', rot: 270 },
    { color: '#5856D6', rot: 315 },
  ];
  const isTinted = appearance === 'tinted';

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="drop-shadow-sm">
      {petals.map((p, i) => (
        <ellipse
          key={i}
          cx="50" cy="28" rx="14" ry="24"
          fill={isTinted ? tintColor : p.color}
          style={{
            transformOrigin: '50px 50px',
            transform: `rotate(${p.rot}deg)`,
            opacity: isTinted ? 0.45 : 0.75, // Overlapping transparency mimicking the HIG
            mixBlendMode: isTinted ? 'screen' : 'normal'
          }}
        />
      ))}
      <circle cx="50" cy="50" r="10" fill={isTinted ? tintColor : '#ffffff'} opacity={isTinted ? 0.2 : 0.9} />
    </svg>
  );
};

// Types for the component
interface DockApp {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  bgGradient: string;
  defaultIconColor?: string;
}

interface MacOSDockProps {
  apps: DockApp[];
  onAppClick: (appId: string) => void;
  openApps?: string[];
  className?: string;
  appearance?: 'default' | 'dark' | 'tinted';
  tintColor?: string;
}

const MacOSDock: React.FC<MacOSDockProps> = ({ 
  apps, 
  onAppClick, 
  openApps = [],
  className = '',
  appearance = 'default',
  tintColor = '#0A84FF'
}) => {
  const [mouseX, setMouseX] = useState<number | null>(null);
  const [currentScales, setCurrentScales] = useState<number[]>(apps.map(() => 1));
  const [currentPositions, setCurrentPositions] = useState<number[]>([]);
  const dockRef = useRef<HTMLDivElement>(null);
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastMouseMoveTime = useRef<number>(0);

  // Responsive size calculations based on viewport
  const getResponsiveConfig = useCallback(() => {
    if (typeof window === 'undefined') {
      return { baseIconSize: 64, maxScale: 1.6, effectWidth: 240 };
    }

    // Base calculations on smaller dimension for better mobile experience
    const smallerDimension = Math.min(window.innerWidth, window.innerHeight);
    
    // Scale icon size based on screen size
    if (smallerDimension < 480) {
      return { baseIconSize: Math.max(40, smallerDimension * 0.08), maxScale: 1.4, effectWidth: smallerDimension * 0.4 };
    } else if (smallerDimension < 768) {
      return { baseIconSize: Math.max(48, smallerDimension * 0.07), maxScale: 1.5, effectWidth: smallerDimension * 0.35 };
    } else if (smallerDimension < 1024) {
      return { baseIconSize: Math.max(56, smallerDimension * 0.06), maxScale: 1.6, effectWidth: smallerDimension * 0.3 };
    } else {
      return { baseIconSize: Math.max(64, Math.min(80, smallerDimension * 0.05)), maxScale: 1.8, effectWidth: 300 };
    }
  }, []);

  const [config, setConfig] = useState(getResponsiveConfig);
  const { baseIconSize, maxScale, effectWidth } = config;
  const minScale = 1.0;
  const baseSpacing = Math.max(4, baseIconSize * 0.08);

  // Update config on window resize
  useEffect(() => {
    const handleResize = () => setConfig(getResponsiveConfig());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getResponsiveConfig]);

  // Authentic macOS cosine-based magnification algorithm
  const calculateTargetMagnification = useCallback((mousePosition: number | null) => {
    if (mousePosition === null) {
      return apps.map(() => minScale);
    }

    return apps.map((_, index) => {
      const normalIconCenter = (index * (baseIconSize + baseSpacing)) + (baseIconSize / 2);
      const minX = mousePosition - (effectWidth / 2);
      const maxX = mousePosition + (effectWidth / 2);
      
      if (normalIconCenter < minX || normalIconCenter > maxX) {
        return minScale;
      }
      
      const theta = ((normalIconCenter - minX) / effectWidth) * 2 * Math.PI;
      const cappedTheta = Math.min(Math.max(theta, 0), 2 * Math.PI);
      const scaleFactor = (1 - Math.cos(cappedTheta)) / 2;
      
      return minScale + (scaleFactor * (maxScale - minScale));
    });
  }, [apps, baseIconSize, baseSpacing, effectWidth, maxScale, minScale]);

  // Calculate positions based on current scales
  const calculatePositions = useCallback((scales: number[]) => {
    let currentX = 0;
    return scales.map((scale) => {
      const scaledWidth = baseIconSize * scale;
      const centerX = currentX + (scaledWidth / 2);
      currentX += scaledWidth + baseSpacing;
      return centerX;
    });
  }, [baseIconSize, baseSpacing]);

  // Initialize positions
  useEffect(() => {
    const initialScales = apps.map(() => minScale);
    setCurrentScales(initialScales);
    setCurrentPositions(calculatePositions(initialScales));
  }, [apps, calculatePositions, minScale, config]);

  // Main Animation loop
  const animateToTarget = useCallback(() => {
    const targetScales = calculateTargetMagnification(mouseX);
    const targetPositions = calculatePositions(targetScales);
    const lerpFactor = mouseX !== null ? 0.2 : 0.12;

    setCurrentScales(prev => prev.map((current, i) => current + ((targetScales[i] - current) * lerpFactor)));
    setCurrentPositions(prev => prev.map((current, i) => current + ((targetPositions[i] - current) * lerpFactor)));

    const needsUpdate = currentScales.some((s, i) => Math.abs(s - targetScales[i]) > 0.002) || 
                        currentPositions.some((p, i) => Math.abs(p - targetPositions[i]) > 0.1);
    
    if (needsUpdate || mouseX !== null) {
      animationFrameRef.current = requestAnimationFrame(animateToTarget);
    }
  }, [mouseX, calculateTargetMagnification, calculatePositions, currentScales, currentPositions]);

  useEffect(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(animateToTarget);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [animateToTarget]);

  // Throttled mouse movement handler
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const now = performance.now();
    if (now - lastMouseMoveTime.current < 16) return;
    lastMouseMoveTime.current = now;
    
    if (dockRef.current) {
      const rect = dockRef.current.getBoundingClientRect();
      const padding = Math.max(8, baseIconSize * 0.12);
      setMouseX(e.clientX - rect.left - padding);
    }
  }, [baseIconSize]);

  const handleMouseLeave = useCallback(() => setMouseX(null), []);

  const createBounceAnimation = (element: HTMLElement) => {
    const bounceHeight = Math.max(-8, -baseIconSize * 0.15);
    element.style.transition = 'transform 0.2s ease-out';
    element.style.transform = `translateY(${bounceHeight}px)`;
    setTimeout(() => { element.style.transform = 'translateY(0px)'; }, 200);
  };

  const handleAppClick = (appId: string, index: number) => {
    if (iconRefs.current[index]) {
      if (typeof window !== 'undefined' && (window as any).gsap) {
        const gsap = (window as any).gsap;
        const bounceHeight = currentScales[index] > 1.3 ? -baseIconSize * 0.2 : -baseIconSize * 0.15;
        gsap.to(iconRefs.current[index], { y: bounceHeight, duration: 0.2, ease: 'power2.out', yoyo: true, repeat: 1, transformOrigin: 'bottom center' });
      } else {
        createBounceAnimation(iconRefs.current[index]!);
      }
    }
    onAppClick(appId);
  };

  const contentWidth = currentPositions.length > 0 
    ? Math.max(...currentPositions.map((pos, index) => pos + (baseIconSize * currentScales[index]) / 2))
    : (apps.length * (baseIconSize + baseSpacing)) - baseSpacing;

  const padding = Math.max(8, baseIconSize * 0.12);

  return (
    <div 
      ref={dockRef}
      className={`backdrop-blur-xl absolute bottom-6 left-1/2 -translate-x-1/2 transition-all duration-300 ${className}`}
      style={{
        width: `${contentWidth + padding * 2}px`,
        background: 'rgba(255, 255, 255, 0.2)',
        borderRadius: `${Math.max(16, baseIconSize * 0.4)}px`,
        border: '1px solid rgba(255, 255, 255, 0.4)',
        boxShadow: `
          0 ${Math.max(4, baseIconSize * 0.1)}px ${Math.max(16, baseIconSize * 0.4)}px rgba(0, 0, 0, 0.15),
          0 ${Math.max(2, baseIconSize * 0.05)}px ${Math.max(8, baseIconSize * 0.2)}px rgba(0, 0, 0, 0.1),
          inset 0 1px 1px rgba(255, 255, 255, 0.5),
          inset 0 -1px 1px rgba(0, 0, 0, 0.1)
        `,
        padding: `${padding}px`
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative" style={{ height: `${baseIconSize}px`, width: '100%' }}>
        {apps.map((app, index) => {
          const scale = currentScales[index];
          const position = currentPositions[index] || 0;
          const scaledSize = baseIconSize * scale;
          const IconComponent = app.icon;
          
          return (
            <div
              key={app.id}
              ref={(el) => { iconRefs.current[index] = el; }}
              className="absolute cursor-pointer flex flex-col items-center justify-end group"
              title={app.name}
              onClick={() => handleAppClick(app.id, index)}
              style={{
                left: `${position - scaledSize / 2}px`,
                bottom: '0px',
                width: `${scaledSize}px`,
                height: `${scaledSize}px`,
                transformOrigin: 'bottom center',
                zIndex: Math.round(scale * 10)
              }}
            >
              {/* Authentic Apple HIG Icon Container Logic */}
              <div 
                className="w-full h-full flex items-center justify-center rounded-[22%] transition-all duration-300 relative overflow-hidden"
                style={{ 
                  background: (appearance === 'dark' || appearance === 'tinted')
                    ? 'linear-gradient(180deg, #3A3A3C 0%, #1C1C1E 100%)' // Apple's official dark icon background
                    : app.bgGradient,
                  boxShadow: (appearance === 'dark' || appearance === 'tinted')
                    ? 'inset 0 1px 1px rgba(255,255,255,0.1), 0 4px 8px rgba(0,0,0,0.4)'
                    : 'inset 0 1px 2px rgba(255,255,255,0.5), 0 4px 8px rgba(0,0,0,0.2)',
                  border: (appearance === 'dark' || appearance === 'tinted') 
                    ? '1px solid rgba(255,255,255,0.05)' 
                    : '1px solid rgba(0,0,0,0.05)',
                }}
              >
                {/* Dynamically shift foreground color based on appearance mode */}
                {app.id === 'photos' ? (
                  <PhotosIcon size={scaledSize * 0.75} appearance={appearance} tintColor={tintColor} />
                ) : (
                  <IconComponent 
                    size={scaledSize * 0.55} 
                    strokeWidth={2.5} // Thicker, filled look per HIG
                    className="transition-colors duration-300 drop-shadow-sm" 
                    color={
                      appearance === 'tinted' 
                        ? tintColor 
                        : appearance === 'dark' 
                          ? app.color // Vibrant brand color on dark background
                          : (app.defaultIconColor || '#ffffff') // Colored icon on white background, else white
                    }
                  />
                )}
              </div>
              
              {/* App Indicator Dot */}
              {openApps.includes(app.id) && (
                <div 
                  className="absolute transition-all duration-300"
                  style={{
                    bottom: `${Math.max(-4, -baseIconSize * 0.1)}px`,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: `${Math.max(4, baseIconSize * 0.08)}px`,
                    height: `${Math.max(4, baseIconSize * 0.08)}px`,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    boxShadow: '0 0 4px rgba(0, 0, 0, 0.4)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Sample app data utilizing lucide-react icons and authentic macOS accent colors
const sampleApps: DockApp[] = [
  { id: 'finder', name: 'Finder', icon: Search, color: '#007AFF', bgGradient: 'linear-gradient(180deg, #2ED3FA 0%, #017BFA 100%)' },
  { id: 'calculator', name: 'Calculator', icon: Calculator, color: '#FF9500', bgGradient: 'linear-gradient(180deg, #5A5D61 0%, #2D3035 100%)' },
  { id: 'terminal', name: 'Terminal', icon: Terminal, color: '#34C759', bgGradient: 'linear-gradient(180deg, #3C3C3C 0%, #1A1A1A 100%)' },
  { id: 'mail', name: 'Mail', icon: Mail, color: '#007AFF', bgGradient: 'linear-gradient(180deg, #59C2FF 0%, #0070F0 100%)' },
  { id: 'notes', name: 'Notes', icon: StickyNote, color: '#FFCC00', bgGradient: 'linear-gradient(180deg, #FFFFFF 0%, #F5F5F7 100%)', defaultIconColor: '#F5B013' },
  { id: 'safari', name: 'Safari', icon: Compass, color: '#007AFF', bgGradient: 'linear-gradient(180deg, #FFFFFF 0%, #F5F5F7 100%)', defaultIconColor: '#007AFF' },
  { id: 'photos', name: 'Photos', icon: null as any, color: '#FF2D55', bgGradient: 'linear-gradient(180deg, #FFFFFF 0%, #F5F5F7 100%)' },
  { id: 'music', name: 'Music', icon: Music, color: '#FA233B', bgGradient: 'linear-gradient(180deg, #FF5B65 0%, #FA233B 100%)' },
  { id: 'calendar', name: 'Calendar', icon: Calendar, color: '#FF3B30', bgGradient: 'linear-gradient(180deg, #FFFFFF 0%, #F5F5F7 100%)', defaultIconColor: '#FF3B30' },
];

export default function App() {
  const [openApps, setOpenApps] = useState<string[]>(['finder', 'safari']);
  const [appearance, setAppearance] = useState<'default' | 'dark' | 'tinted'>('default');

  const handleAppClick = (appId: string) => {
    // Toggle app in openApps array
    setOpenApps(prev => 
      prev.includes(appId) 
        ? prev.filter(id => id !== appId)
        : [...prev, appId]
    );
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-900 flex flex-col items-center justify-center">
      
      {/* HIG Appearance Controls */}
      <div className="absolute top-10 flex space-x-4 bg-white/10 p-2 rounded-2xl backdrop-blur-md border border-white/20 z-50">
        {(['default', 'dark', 'tinted'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setAppearance(mode)}
            className={`px-6 py-2 rounded-xl text-sm font-medium capitalize transition-all duration-300 ${appearance === mode ? 'bg-white text-black shadow-md' : 'text-white hover:bg-white/20'}`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* The Dock Component */}
      <MacOSDock
        apps={sampleApps}
        onAppClick={handleAppClick}
        openApps={openApps}
        appearance={appearance}
        tintColor="#0A84FF" // Authentic Apple System Blue
      />
    </div>
  );
}