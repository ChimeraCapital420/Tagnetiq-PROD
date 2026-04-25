// FILE: src/components/vault/components/VaultSkeletonLoader.tsx
export const VaultSkeletonLoader = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="bg-gray-800/20 backdrop-blur-sm p-4 rounded-lg animate-pulse">
        <div className="w-full h-40 md:h-48 bg-gray-700/50 rounded-md mb-4" />
        <div className="h-6 w-3/4 bg-gray-700/50 rounded" />
        <div className="h-4 w-1/2 bg-gray-700/50 rounded mt-2" />
      </div>
    ))}
  </div>
);