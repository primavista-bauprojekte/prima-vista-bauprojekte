import type { SVGProps } from 'react';
import type { MaterialIconKey } from '../../data/materialien';

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

function TileIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" />
    </svg>
  );
}

function LayersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z" />
      <path d="m3 12 9 4.5L21 12" />
      <path d="m3 16.5 9 4.5 9-4.5" />
    </svg>
  );
}

function BathIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 11V6a2 2 0 0 1 3.5-1.3" />
      <path d="M7 7.5h3" />
      <path d="M3 11h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-2Z" />
      <path d="M7 18.5 6 21M17 18.5l1 2.5" />
    </svg>
  );
}

function DoorIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17" />
      <path d="M4 21h16" />
      <circle cx="14.5" cy="12.5" r="0.9" />
    </svg>
  );
}

function BulbIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 17.5a5.5 5.5 0 1 1 6 0V19a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1.5Z" />
      <path d="M10 22h4" />
    </svg>
  );
}

function WindowIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1" />
      <path d="M12 3.5v17M3.5 12h17" />
    </svg>
  );
}

const ICONS: Record<MaterialIconKey, (props: IconProps) => React.ReactElement> = {
  tile: TileIcon,
  layers: LayersIcon,
  bath: BathIcon,
  door: DoorIcon,
  bulb: BulbIcon,
  window: WindowIcon,
};

export default function MaterialIcon({ name, ...props }: IconProps & { name: MaterialIconKey }) {
  const Icon = ICONS[name];
  return <Icon {...props} />;
}
