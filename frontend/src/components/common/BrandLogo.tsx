export interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark' | 'yellow';
  showText?: boolean;
  subtitle?: string;
  className?: string;
  textClassName?: string;
}

const SIZE_CONFIGS = {
  sm: {
    img: 'h-7 w-auto',
    title: 'text-base font-extrabold tracking-tight',
    sub: 'text-[9px] font-semibold tracking-wider uppercase',
  },
  md: {
    img: 'h-9 w-auto',
    title: 'text-lg md:text-xl font-extrabold tracking-tight',
    sub: 'text-[10px] font-semibold tracking-wider uppercase',
  },
  lg: {
    img: 'h-11 w-auto',
    title: 'text-xl md:text-2xl font-black tracking-tight',
    sub: 'text-[11px] font-semibold tracking-wider uppercase',
  },
  xl: {
    img: 'h-14 w-auto',
    title: 'text-2xl md:text-3xl font-black tracking-tight',
    sub: 'text-xs font-semibold tracking-wider uppercase',
  },
};

/**
 * BrandLogo — Official SkillOrbit AI branding element using the verified /web-logo.png asset.
 * Preserves exact aspect ratio and supports both White+Blue (light) and Black+Lime (dark) themes.
 */
export function BrandLogo({
  size = 'md',
  variant = 'light',
  showText = true,
  subtitle,
  className = '',
  textClassName = '',
}: BrandLogoProps) {
  const config = SIZE_CONFIGS[size];

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Official SkillOrbit AI Logo Asset */}
      <img
        src="/web-logo.png"
        alt="SkillOrbit AI"
        className={`${config.img} object-contain shrink-0 transition-transform duration-200`}
        loading="eager"
      />

      {showText && (
        <div className={`flex flex-col text-left leading-tight ${textClassName}`}>
          {variant === 'yellow' ? (
            /* Landing Page Theme: Premium Black + Yellow */
            <>
              <span className={`${config.title} text-white`}>
                Skill<span className="text-yellow-400">Orbit</span>{' '}
                <span className="text-yellow-400 font-bold">AI</span>
              </span>
              {subtitle && (
                <span className={`${config.sub} text-neutral-400`}>
                  {subtitle}
                </span>
              )}
            </>
          ) : variant === 'light' ? (
            /* White + Blue Theme */
            <>
              <span className={`${config.title} text-slate-900`}>
                Skill<span className="text-blue-600">Orbit</span>{' '}
                <span className="text-blue-900 font-bold">AI</span>
              </span>
              {subtitle && (
                <span className={`${config.sub} text-slate-500`}>
                  {subtitle}
                </span>
              )}
            </>
          ) : (
            /* Internal App Theme: Black + Yellow-Green (Lime) */
            <>
              <span className={`${config.title} text-[#F5F7F2]`}>
                Skill<span className="text-[#C6F500]">Orbit</span>{' '}
                <span className="text-[#F5F7F2] font-semibold">AI</span>
              </span>
              {subtitle && (
                <span className={`${config.sub} text-[#A3ADA0]`}>
                  {subtitle}
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default BrandLogo;
