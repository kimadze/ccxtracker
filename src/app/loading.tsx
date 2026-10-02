export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="იტვირთება"
      className="mx-auto max-w-[1600px] space-y-4 p-4"
    >
      <div className="skeleton h-8 w-60" />
      <div className="skeleton h-52 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="skeleton h-64 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    </div>
  );
}
