const POPULAR_SERVICES = [
  { title: 'Website development', query: 'website', icon: '⌘', className: 'website' },
  { title: 'Video editing', query: 'video', icon: '▶', className: 'video' },
  { title: 'App development', query: 'app', icon: '▣', className: 'app' },
  { title: 'SEO expert', query: 'seo', icon: '↗', className: 'seo' },
  { title: 'Social media marketing', query: 'social media', icon: '◎', className: 'social' },
  { title: 'Graphic design', query: 'design', icon: '✦', className: 'design' },
  { title: 'Tutoring', query: 'tutor', icon: '◇', className: 'tutor' },
]

export default function PopularServices({ onSelect }) {
  return (
    <section className="gs-section gs-section-compact" aria-labelledby="popular-services-title">
      <div className="gs-section-heading">
        <h2 id="popular-services-title">Popular services</h2>
      </div>

      <div className="gs-popular-services">
        {POPULAR_SERVICES.map(service => (
          <button
            key={service.className}
            type="button"
            className={`gs-service-category gs-category-${service.className}`}
            onClick={() => onSelect(service.query)}
            aria-label={`Find ${service.title.toLowerCase()} listings`}
          >
            <span>{service.title}</span>
            <span className="gs-category-icon" aria-hidden="true">{service.icon}</span>
          </button>
        ))}
      </div>
    </section>
  )
}