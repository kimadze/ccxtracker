export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="იტვირთება"
      className="loading-workspace mx-auto max-w-6xl space-y-4 p-6"
    >
      <div className="skeleton h-8 w-60" />
      <div className="skeleton h-52 rounded-xl" />
      <div className="grid grid-cols-2 gap-6">
        <div className="skeleton h-64 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    </div>
  );
}
