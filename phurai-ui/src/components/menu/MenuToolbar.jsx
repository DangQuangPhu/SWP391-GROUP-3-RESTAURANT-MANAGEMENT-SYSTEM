import { formIcons } from '@/data/iconAssets';

const SORT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
];

function MenuToolbar({ searchTerm, onSearchChange, sortOrder, onSortChange, resultCount }) {
  return (
    <div className="menu-toolbar">
      <label className="menu-toolbar__search">
        <span className="menu-toolbar__search-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12.5 11H11.71L11.43 10.73C12.41 9.59 13 8.11 13 6.5C13 2.91 10.09 0 6.5 0C2.91 0 0 2.91 0 6.5C0 10.09 2.91 13 6.5 13C8.11 13 9.59 12.41 10.73 11.43L11 11.71V12.5L16 17.49L17.49 16L12.5 11ZM6.5 11C4.01 11 2 8.99 2 6.5C2 4.01 4.01 2 6.5 2C8.99 2 11 4.01 11 6.5C11 8.99 8.99 11 6.5 11Z"
              fill="currentColor"
            />
          </svg>
        </span>
        <input
          type="search"
          className="menu-toolbar__input"
          placeholder="Search dishes..."
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          aria-label="Search dishes"
        />
      </label>

      <div className="menu-toolbar__sort">
        <label className="menu-toolbar__sort-label" htmlFor="menu-sort-order">
          Sort by price
        </label>
        <div className="menu-toolbar__select-wrap">
          <select
            id="menu-sort-order"
            className="menu-toolbar__select"
            value={sortOrder}
            onChange={(event) => onSortChange(event.target.value)}
            aria-label="Sort by price"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <img src={formIcons.chevronDown} alt="" className="menu-toolbar__select-icon" />
        </div>
      </div>

      <p className="menu-toolbar__meta" aria-live="polite">
        {resultCount} {resultCount === 1 ? 'dish' : 'dishes'}
      </p>
    </div>
  );
}

export default MenuToolbar;
