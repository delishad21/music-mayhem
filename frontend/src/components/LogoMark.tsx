import Image from 'next/image';

interface LogoMarkProps {
  size?: number;
  className?: string;
}

export default function LogoMark({ size = 32, className = '' }: LogoMarkProps) {
  return (
    <Image
      src="/logo.svg"
      alt=""
      aria-hidden
      width={size}
      height={size}
      unoptimized
      draggable={false}
      className={`block flex-shrink-0 select-none ${className}`}
    />
  );
}
