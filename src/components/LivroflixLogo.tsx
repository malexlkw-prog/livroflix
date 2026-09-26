import React from 'react';

interface LivroflixLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dark-bg' | 'light-bg';
  logoImageUrl?: string;
  logoText?: string;
}

/**
 * Exact vector reproduction of `livroflix_final.png` with support for custom uploaded/pasted
 * logo image or custom brand text from PlatformSettings.
 */
export const LivroflixLogo: React.FC<LivroflixLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'dark-bg',
  logoImageUrl,
  logoText,
}) => {
  const heightClass =
    size === 'sm'
      ? 'h-7'
      : size === 'md'
      ? 'h-9 sm:h-10'
      : 'h-12 sm:h-14';

  if (logoImageUrl && logoImageUrl.trim() !== '') {
    return (
      <div
        className={`inline-flex items-center select-none ${heightClass} ${className}`}
        aria-label={logoText || 'livroflix'}
      >
        <img
          src={logoImageUrl}
          alt={logoText || 'Logo'}
          className="h-full w-auto object-contain"
        />
      </div>
    );
  }

  if (
    logoText &&
    logoText.trim() !== '' &&
    logoText.trim().toUpperCase() !== 'LIVROFLIX'
  ) {
    return (
      <div
        className={`inline-flex items-center select-none ${heightClass} ${className}`}
        aria-label={logoText}
      >
        <span className="font-display text-xl sm:text-2xl font-black tracking-tight text-white">
          {logoText}
        </span>
      </div>
    );
  }

  const textColor = variant === 'light-bg' ? '#0A2239' : '#FFFFFF';

  return (
    <div
      className={`inline-flex items-center select-none ${heightClass} ${className}`}
      aria-label="livroflix"
    >
      <svg
        viewBox="0 0 530 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto overflow-visible"
      >
        {/* "livr" — Bold geometric sans */}
        <g fill={textColor}>
          {/* l */}
          <rect x="10" y="16" width="18" height="96" />
          {/* i */}
          <circle cx="51" cy="24" r="11" />
          <rect x="42" y="43" width="18" height="69" />
          {/* v */}
          <path d="M70 43H89L106 90L123 43H142L115 112H97L70 43Z" />
          {/* r */}
          <path d="M151 43H168V55C173 46 181 42 192 42C195 42 198 42.5 200 43V60C197 59 193 58.5 189 58.5C176 58.5 169 65 169 78V112H151V43Z" />
        </g>

        {/* Clean Open Book with Solid Play Triangle in Center (forming the "o") */}
        <g transform="translate(208, 28)">
          {/* Outer Orange Book Contour */}
          <path
            d="M4 13C21 10 39 15 51 27C63 15 81 10 98 13C100.5 13.5 102 15.5 102 18V77C102 79.8 99.8 81.8 97 81.3C81 78.5 64 81.5 51 89C38 81.5 21 78.5 5 81.3C2.2 81.8 0 79.8 0 77V18C0 15.5 1.5 13.5 4 13Z"
            fill="#F79E1B"
            stroke="#52525B"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* White Inner Open Pages (Single continuous white interior without vertical spine line) */}
          <path
            d="M8.5 20.5C23 18.2 38.5 22.8 51 34.5C63.5 22.8 79 18.2 93.5 20.5V72.5C79 70 63.5 73.2 51 80.5C38.5 73.2 23 70 8.5 72.5V20.5Z"
            fill="#FFFFFF"
            stroke="#D97706"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* Solid Filled Golden-Orange Play Triangle in the Center */}
          <path
            d="M41 39.5C41 37.3 43.4 36 45.3 37.2L64.5 49.2C66.3 50.3 66.3 52.9 64.5 54L45.3 66C43.4 67.2 41 65.9 41 63.7V39.5Z"
            fill="#F79E1B"
            stroke="#B45309"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </g>

        {/* "flix" — Bold geometric sans */}
        <g fill={textColor}>
          {/* f */}
          <path d="M326 43H314V30H326V25C326 11 335 4 352 4C357 4 362 4.8 365 5.5V19.5C362 18.8 358 18.5 354 18.5C346 18.5 344 21.5 344 27.5V30H362V43H344V112H326V43Z" />
          {/* l */}
          <rect x="373" y="16" width="18" height="96" />
          {/* i */}
          <circle cx="415" cy="24" r="11" />
          <rect x="406" y="43" width="18" height="69" />
          {/* x */}
          <path d="M435 43H455L471 67L487 43H507L481 76L509 112H489L471 86L453 112H433L461 76L435 43Z" />
        </g>
      </svg>
    </div>
  );
};
