export default function Spinner({ size = 40, className = '' }) {
  return (
    <div className={`spinner-container ${className}`}>
      <svg
        className="spinner"
        width={size}
        height={size}
        viewBox="0 0 50 50"
        aria-label="Loading"
      >
        <circle
          className="spinner-track"
          cx="25"
          cy="25"
          r="20"
          fill="none"
          strokeWidth="4"
        />
        <circle
          className="spinner-head"
          cx="25"
          cy="25"
          r="20"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
