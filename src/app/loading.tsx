export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="იტვირთება"
      className="mx-auto flex max-w-[1600px] items-center gap-3 p-4 lg:p-5"
    >
      <span className="loading loading-spinner loading-sm text-primary" />
      <span className="text-sm text-base-content/60">იტვირთება…</span>
    </div>
  );
}
