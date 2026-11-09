export default function Loading() {
  return (
    <div className="container-page py-10" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-8 w-48" />
      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="skeleton aspect-[16/9] w-full" />
          <div className="skeleton h-5 w-2/3" />
          <div className="skeleton h-5 w-1/2" />
        </div>
        <div className="skeleton h-80 w-full" />
      </div>
    </div>
  );
}
