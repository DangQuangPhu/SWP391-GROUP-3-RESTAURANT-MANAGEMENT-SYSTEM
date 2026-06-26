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
    <aside className="menu-sidebar sticky top-[72px] z-40 flex overflow-x-auto whitespace-nowrap bg-white border-b px-4 py-2 lg:flex-col lg:w-64 lg:static lg:border-none lg:px-0 lg:py-6 scrollbar-hide" aria-label="Menu categories">
      <div className="menu-sidebar__inner flex lg:block w-full">
      <nav className="menu-sidebar__nav flex gap-2 lg:flex-col lg:gap-0">
        <button
          type="button"
          className={`menu-sidebar__item flex items-center gap-2 px-4 py-2 lg:px-0 lg:py-3 rounded-full border lg:border-none lg:rounded-none transition-colors ${selectedCategory === 'all' ? 'bg-amber-50 border-amber-500 text-amber-600 lg:bg-transparent is-active' : 'border-gray-200 text-gray-600'}`}
          onClick={() => onSelectCategory('all')}
          aria-current={selectedCategory === 'all' ? 'true' : undefined}
        >
          <div className="hidden lg:block">
            <AllMenuIcon active={selectedCategory === 'all'} />
          </div>
          <span className="font-medium lg:font-normal">All Menu</span>
        </button>

        {categories.map((category) => {
          const iconSrc = menuCategoryIcons[category.iconKey];
          const isActive = selectedCategory === category.id;

          return (
            <button
              key={category.id}
              type="button"
              className={`menu-sidebar__item flex items-center gap-2 px-4 py-2 lg:px-0 lg:py-3 rounded-full border lg:border-none lg:rounded-none transition-colors ${isActive ? 'bg-amber-50 border-amber-500 text-amber-600 lg:bg-transparent is-active' : 'border-gray-200 text-gray-600'}${category.multiline ? ' menu-sidebar__item--multiline' : ''}`}
              onClick={() => onSelectCategory(category.id)}
              aria-current={isActive ? 'true' : undefined}
            >
              <img
                src={iconSrc}
                alt=""
                className={`menu-category-icon hidden lg:block ${category.iconClass}`}
              />
              <span className="font-medium lg:font-normal">
                {category.multiline
                  ? category.name.split(' & ').map((line, index) => (
                      <span key={line}>
                        {index > 0 ? (
                          <>
                            <br className="hidden lg:block" />
                            <span className="lg:hidden"> &amp; </span>
                            <span className="hidden lg:inline">&amp; </span>{line}
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

      <button type="button" className="menu-sidebar__cta hidden lg:block" onClick={onReserve}>
        RESERVE A TABLE
      </button>
      </div>
    </aside>
  );
}

export default MenuSidebar;
