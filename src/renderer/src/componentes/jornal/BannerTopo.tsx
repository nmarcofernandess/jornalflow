import { useDataDir, imageUrl } from '@renderer/lib/image-url'

interface BannerTopoProps {
  banner_path: string | null
}

export function BannerTopo({ banner_path }: BannerTopoProps) {
  const dataDir = useDataDir()
  if (!banner_path) return null

  return (
    <div className="w-full" data-export="banner-topo">
      <img
        src={imageUrl(dataDir, banner_path)}
        alt="Banner"
        className="w-full h-auto object-cover"
      />
    </div>
  )
}
