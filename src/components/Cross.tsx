import './Cross.css';

interface CrossProps {
  className?: string;
  thickness?: number;
}

const Cross: React.FC<CrossProps> = ({ className, thickness = 30 }) => {
  const half = thickness / 2;
  return (
    <svg
      className={`cross${className ? ` ${className}` : ''}`}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <rect x="0" y={50 - half} width="100" height={thickness} fill="currentColor" />
      <rect x={50 - half} y="0" width={thickness} height="100" fill="currentColor" />
    </svg>
  );
};

export default Cross;
