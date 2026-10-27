import { useNavigate } from 'react-router-dom';

interface ViitsaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  light?: boolean;
  className?: string;
  showText?: boolean;
  showSlogan?: boolean;
}

export function ViitsaLogo({ size = 'md', light = false, className = '', showText = true, showSlogan = true }: ViitsaLogoProps) {
  const navigate = useNavigate();
  const sz = {
    sm: { box: 'w-8 h-8 rounded-lg', text: 'text-base', slogan: 'text-[8px]', gap: 'gap-2' },
    md: { box: 'w-10 h-10 rounded-xl', text: 'text-xl', slogan: 'text-[9px]', gap: 'gap-2.5' },
    lg: { box: 'w-14 h-14 rounded-2xl', text: 'text-2xl', slogan: 'text-[10px]', gap: 'gap-3' },
  }[size];

  return (
    <button
      onClick={() => navigate('/')}
      className={`flex items-center ${sz.gap} group ${className}`}
      aria-label="VIITSA — Home"
    >
      <div className={`${sz.box} flex items-center justify-center overflow-hidden shrink-0`}>
        <img src="/official_logo_VIITSA.png" alt="VIITSA" className="w-full h-full object-contain" />
      </div>
      {showText && (
        <div className="flex flex-col items-start leading-none">
          <span className={`${sz.text} font-bold tracking-tight ${light ? 'text-white' : 'text-slate-800'}`}>
            VIITSA
          </span>
          {showSlogan && (
            <span className={`${sz.slogan} font-medium uppercase tracking-wider whitespace-nowrap ${light ? 'text-white/50' : 'text-slate-400'}`}>
              Smarter Healthcare, For Everyone
            </span>
          )}
        </div>
      )}
    </button>
  );
}
