import { menuCategoryIcons } from '@/data/iconAssets';

function AllMenuIcon({ active }) {
  return (
    <span
      className={`menu-sidebar__all-icon${active ? ' menu-sidebar__all-icon--active' : ''}`}
      aria-hidden="true"
    >
      <svg
        className="menu-category-icon menu-category-icon--all"
        viewBox="0 0 20 20"
        fill="none"
      >
        <rect x="1.5" y="2" width="7.5" height="7.5" rx="1.2" fill="currentColor" opacity="0.82" />
        <rect x="11" y="2" width="7.5" height="7.5" rx="1.2" fill="currentColor" opacity="0.82" />
        <rect x="1.5" y="10.5" width="7.5" height="7.5" rx="1.2" fill="currentColor" opacity="0.82" />
        <path
          d="M12.2 13.4L14.1 15.3L17.8 11.6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="11"
          y="10.5"
          width="7.5"
          height="7.5"
          rx="1.2"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
        />
      </svg>
    </span>
  );
}

function MenuSidebar({ categories, selectedCategory, onSelectCategory, onReserve }) {
  return (
    <aside className="menu-sidebar" aria-label="Menu categories">
      <nav className="menu-sidebar__nav">
        <button
          type="button"
          className={`menu-sidebar__item${selectedCategory === 'all' ? ' is-active' : ''}`}
          onClick={() => onSelectCategory('all')}
          aria-current={selectedCategory === 'all' ? 'true' : undefined}
        >
          <AllMenuIcon active={selectedCategory === 'all'} />
          <span>All Menu</span>
        </button>

        {categories.map((category) => {
          const iconSrc = menuCategoryIcons[category.iconKey];
          const isActive = selectedCategory === category.id;

          return (
            <button
              key={category.id}
              type="button"
              className={`menu-sidebar__item${isActive ? ' is-active' : ''}${category.multiline ? ' menu-sidebar__item--multiline' : ''}`}
              onClick={() => onSelectCategory(category.id)}
              aria-current={isActive ? 'true' : undefined}
            >
              <img
                src={iconSrc}
                alt=""
                className={`menu-category-icon ${category.iconClass}`}
              />
              <span>
                {category.multiline
                  ? category.name.split(' & ').map((line, index) => (
                      <span key={line}>
                        {index > 0 ? (
                          <>
                            <br />
                            &amp; {line}
                          </>
                        ) : (
                          line
                        )}
                      </span>
                    ))
                  : category.name}
              </span>
            </button>
          );
        })}
      </nav>

      <button type="button" className="menu-sidebar__cta" onClick={onReserve}>
        RESERVE A TABLE
      </button>
    </aside>
  );
}

export default MenuSidebar;
