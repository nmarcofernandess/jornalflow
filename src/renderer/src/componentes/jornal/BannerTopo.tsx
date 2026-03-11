interface BannerTopoProps {
  banner_path: string | null
}

export function BannerTopo({ banner_path }: BannerTopoProps) {
  if (!banner_path) return null

  return (
    <div className="w-full" data-export="banner-topo">
      <img
        src={`file://${banner_path}`}
        alt="Banner"
        className="w-full h-auto object-cover"
      />
    </div>
  )
}
