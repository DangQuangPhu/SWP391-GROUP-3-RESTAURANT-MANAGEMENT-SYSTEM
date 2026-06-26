import { useState } from "react";
import "../styles/catering.css";

const corporateSections = [
  {
    title: "Lunch Boxes",
    items: [
      {
        name: "Phūrai Style Bento",
        desc: "Chef's selection of sashimi, sushi, black cod miso, and dessert.",
        price: "65",
      },
      {
        name: "Vegetarian Bento",
        desc: "Chef's selection of vegetable rolls, salads, and hot vegetable dishes.",
        price: "50",
      },
    ],
  },
  {
    title: "Meeting Platters",
    items: [
      {
        name: "Sashimi & Sushi Platter (Large)",
        desc: "72 pieces of premium assorted sashimi and nigiri.",
        price: "220",
      },
      {
        name: "Vegetable Maki Platter",
        desc: "50 pieces of assorted vegetable rolls.",
        price: "110",
      },
    ],
  },
];

const privateSections = [
  {
    title: "Signature Platters",
    items: [
      {
        name: "Yellowtail Jalapeño Platter",
        desc: "24 pieces of our signature Yellowtail Sashimi with Garlic Puree, Serrano Pepper, and Yuzu Soy Sauce.",
        price: "120",
      },
      {
        name: "Maki Sushi Selection",
        desc: "A curated collection of 48 pieces including Spicy Tuna, Salmon Avocado, Yellowtail Scallion, and California Rolls.",
        price: "185",
      },
      {
        name: "Black Cod Miso Skewers",
        desc: "20 individual skewers of our world-famous Black Cod with Miso, served with pickled ginger shoots.",
        price: "240",
      },
    ],
  },
  {
    title: "Hot Kitchen Large Trays",
    items: [
      {
        name: "Wagyu Beef Slider Box",
        desc: "12 Wagyu sliders with truffle aioli, pickled onion, and brioche bun.",
        price: "165",
      },
      {
        name: "Rock Shrimp Tempura Tray",
        desc: "Large portion of crispy rock shrimp served with creamy spicy or butter ponzu sauce.",
        price: "140",
      },
    ],
  },
];

function CateringMenuSection({ title, items }) {
  return (
    <section className="catering-menu-section">
      <h2>{title}</h2>

      <div className="catering-menu-list">
        {items.map((item) => (
          <article className="catering-menu-item" key={item.name}>
            <div>
              <h3>{item.name}</h3>
              <p>{item.desc}</p>
            </div>

            <span>{item.price}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function Catering() {
  const [activeTab, setActiveTab] = useState("corporate");
  const isCorporate = activeTab === "corporate";
  const sections = isCorporate ? corporateSections : privateSections;

  return (
    <main className="catering-page">
      <section className="catering-header">
        <h1>Catering</h1>

        <div className="catering-tabs">
          <button
            type="button"
            className={isCorporate ? "is-active" : ""}
            onClick={() => setActiveTab("corporate")}
          >
            Corporate
          </button>

          <button
            type="button"
            className={!isCorporate ? "is-active" : ""}
            onClick={() => setActiveTab("private")}
          >
            Private
          </button>
        </div>
      </section>

      <section className="catering-body">
        {sections.map((section) => (
          <CateringMenuSection
            key={section.title}
            title={section.title}
            items={section.items}
          />
        ))}

        <section className="catering-custom">
          <h2>Custom Events</h2>
          <p>
            For large-scale events, custom menus, or full-service on-site
            catering including private chefs, please contact our events team.
          </p>

          <button type="button">Inquire Today</button>
        </section>
      </section>
    </main>
  );
}

export default Catering;