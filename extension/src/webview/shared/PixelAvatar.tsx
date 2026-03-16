import React from 'react';
import { PIXEL_DATA } from './pixel-data';

interface PixelAvatarProps {
  id: string;
  size: number;
  className?: string;
}

export function PixelAvatar({ id, size, className }: PixelAvatarProps): React.ReactElement | null {
  const char = PIXEL_DATA[id];
  if (!char) return null;

  const ps = size / 16;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated' }}
      className={className}
    >
      {char.grid.flatMap((row, y) =>
        row.map((colorIndex, x) =>
          colorIndex ? (
            <rect
              key={`${y}-${x}`}
              x={x * ps}
              y={y * ps}
              width={ps + 0.5}
              height={ps + 0.5}
              fill={char.palette[colorIndex]}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
