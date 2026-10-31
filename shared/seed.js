import { CATALOG_PRICES } from './catalog.js';

/**
 * First-run data. Loaded into the database once by the initial migration;
 * after that, the team manages products and settings in the admin panel.
 *
 * Values marked CONFIRM must be checked by the merchant before launch (see
 * README "Launch checklist"). Nothing here is ever re-applied over admin edits.
 */

const FOXNUT_HIGHLIGHTS = {
  de: ['Geröstet, nicht frittiert', 'Glutenfrei', 'Reich an Ballaststoffen'],
  en: ['Roasted, not fried', 'Gluten free', 'Rich in fibre'],
};

const foxnuts = ({ id, code, accent, de, en, sortOrder }) => ({
  id,
  slug: id,
  sku: `EV-MKH-${code}`,
  range: 'foxnuts',
  accent,
  image: `/images/${id}.webp`,
  price: CATALOG_PRICES.foxnuts,
  vat: { DE: 7, GB: 20 }, // CONFIRM with your tax adviser
  netWeightGrams: null, // CONFIRM: needed for the price per kg (PAngV)
  inStock: true,
  active: true,
  featured: true,
  isNew: false,
  bundleEligible: true,
  sortOrder,
  nutrition: null, // CONFIRM: per 100 g, required by EU Reg. 1169/2011
  i18n: {
    de: {
      name: de.name,
      fullName: `Geröstete Fuchsnüsse (Makhana) ${de.name}`,
      description: de.description,
      ingredients: '',
      allergens: '',
      storage: 'Kühl und trocken lagern. Nach dem Öffnen gut verschließen.',
      howToEnjoy: 'Pur aus der Tüte, zum Film, zum Tee oder als leichtere Alternative zu Chips.',
      highlights: FOXNUT_HIGHLIGHTS.de,
    },
    en: {
      name: en.name,
      fullName: `Roasted Foxnuts (Makhana) ${en.name}`,
      description: en.description,
      ingredients: '',
      allergens: '',
      storage: 'Store in a cool, dry place. Reseal after opening.',
      howToEnjoy:
        'Straight from the pouch, with a film, next to your tea or as a lighter swap for crisps.',
      highlights: FOXNUT_HIGHLIGHTS.en,
    },
  },
});

const protein = ({ id, code, accent, de, en, sortOrder }) => ({
  id: `protein-${id}`,
  slug: `plant-protein-${id}`,
  sku: `EV-PRO-${code}`,
  range: 'protein',
  accent,
  image: `/images/protein-${id}.webp`,
  price: CATALOG_PRICES.protein,
  vat: { DE: 7, GB: 20 }, // CONFIRM with your tax adviser
  netWeightGrams: null,
  inStock: true,
  active: true,
  featured: false,
  isNew: false,
  bundleEligible: false,
  sortOrder,
  nutrition: null,
  i18n: {
    de: {
      name: `Plant Protein ${de.name}`,
      fullName: `Pflanzliches Protein aus gerösteten Kichererbsen, ${de.name}`,
      description: de.description,
      ingredients: '',
      allergens: '',
      storage: 'Kühl und trocken lagern. Dose nach Gebrauch fest verschließen.',
      howToEnjoy:
        'Mit kaltem Wasser oder deiner Lieblingsmilch im Shaker mischen. Portionsgröße siehe Dose.',
      highlights: ['Hoher Proteingehalt', 'Hoher Ballaststoffgehalt', 'Natürliche Energie'],
    },
    en: {
      name: `${en.name} Plant Protein`,
      fullName: `Roasted Chickpea Plant Protein, ${en.name}`,
      description: en.description,
      ingredients: '',
      allergens: '',
      storage: 'Store in a cool, dry place. Close the jar tightly after use.',
      howToEnjoy: 'Shake with cold water or the milk of your choice. See the jar for serving size.',
      highlights: ['High protein', 'High fibre', 'Natural energy'],
    },
  },
});

export const SEED_PRODUCTS = [
  foxnuts({
    id: 'cream-onion',
    code: 'CRON',
    accent: '#2f6b35',
    sortOrder: 10,
    de: {
      name: 'Cream & Onion',
      description:
        'Klassisch, cremig und herzhaft. Eine feine Zwiebel-Sahne-Würzung auf leichten, knusprig gerösteten Fuchsnüssen.',
    },
    en: {
      name: 'Cream & Onion',
      description:
        'Classic, rich and savoury. A creamy onion seasoning on light, crisp roasted foxnuts.',
    },
  }),
  foxnuts({
    id: 'peri-peri',
    code: 'PERI',
    accent: '#b3282b',
    sortOrder: 20,
    de: {
      name: 'Peri Peri',
      description:
        'Feurig, mutig und aufregend. Knusprige Fuchsnüsse mit lebhafter Peri-Peri-Schärfe.',
    },
    en: {
      name: 'Peri Peri',
      description: 'Spicy, bold and exciting. Crisp roasted foxnuts with a lively peri peri kick.',
    },
  }),
  foxnuts({
    id: 'asian-pepper-garlic',
    code: 'APGR',
    accent: '#c7302f',
    sortOrder: 30,
    de: {
      name: 'Asian Pepper & Garlic',
      description:
        'Grob gemahlener Pfeffer und Knoblauch auf luftigen Fuchsnüssen, in Olivenöl geröstet.',
    },
    en: {
      name: 'Asian Pepper & Garlic',
      description: 'Cracked pepper and garlic on light, airy foxnuts, roasted in olive oil.',
    },
  }),
  foxnuts({
    id: 'pink-salt-pepper',
    code: 'PSBP',
    accent: '#26272b',
    sortOrder: 40,
    de: {
      name: 'Himalaya Salz & Pfeffer',
      description:
        'Schlicht, klar und pur. Rosa Himalayasalz und schwarzer Pfeffer auf gerösteten Fuchsnüssen.',
    },
    en: {
      name: 'Himalayan Salt & Pepper',
      description:
        'Simple, clean and pure. Himalayan pink salt and black pepper on roasted foxnuts.',
    },
  }),
  foxnuts({
    id: 'cheese-herbs',
    code: 'CHHB',
    accent: '#7c76c4',
    sortOrder: 50,
    de: {
      name: 'Käse & Kräuter',
      description: 'Käse und frische Kräuter auf knackigen Fuchsnüssen, in Olivenöl geröstet.',
    },
    en: {
      name: 'Cheese & Herbs',
      description: 'Cheese and fresh herbs on crunchy foxnuts, roasted in olive oil.',
    },
  }),
  foxnuts({
    id: 'four-cheese',
    code: '4CHZ',
    accent: '#2a3fb0',
    sortOrder: 60,
    de: {
      name: 'Vier Käse',
      description:
        'Eine reichhaltige Vier-Käse-Würzung auf gerösteten Fuchsnüssen, in Olivenöl geröstet.',
    },
    en: {
      name: 'Four Cheese',
      description: 'A rich four-cheese seasoning on roasted foxnuts, roasted in olive oil.',
    },
  }),
  foxnuts({
    id: 'butter-chicken',
    code: 'BTCK',
    accent: '#c7662e',
    sortOrder: 70,
    de: {
      name: 'Butter Chicken',
      description:
        'Buttrig, warm gewürzt und wohltuend. Butter-Chicken-Geschmack auf in Olivenöl gerösteten Fuchsnüssen.',
    },
    en: {
      name: 'Butter Chicken',
      description:
        'Buttery, warmly spiced and comforting. Butter chicken flavour on foxnuts roasted in olive oil.',
    },
  }),
  protein({
    id: 'mango',
    code: 'MNGO',
    accent: '#e9a52c',
    sortOrder: 110,
    de: {
      name: 'Mango',
      description:
        'Pflanzliches Protein aus gerösteten schwarzen Kichererbsen mit sonnigem Mango-Geschmack. Der fruchtige Shake nach dem Training.',
    },
    en: {
      name: 'Mango',
      description:
        'Plant protein from roasted black chickpeas with a sunny mango flavour. The fruity shake for after the gym.',
    },
  }),
  protein({
    id: 'royal-cream',
    code: 'RYCR',
    accent: '#a0825a',
    sortOrder: 120,
    de: {
      name: 'Royal Cream',
      description:
        'Pflanzliches Protein aus gerösteten Kichererbsen, cremig und nussig. Kalt anrühren, langsam genießen.',
    },
    en: {
      name: 'Royal Cream',
      description:
        'Plant protein from roasted chickpeas with a rich, creamy, nutty profile. Mix it cold, sip it slow.',
    },
  }),
  protein({
    id: 'chocolate',
    code: 'CHOC',
    accent: '#5a3322',
    sortOrder: 130,
    de: {
      name: 'Schokolade',
      description:
        'Pflanzliches Protein aus gerösteten Kichererbsen mit Kakao. Ein Schoko-Shake, der ganz nebenbei pflanzlich ist.',
    },
    en: {
      name: 'Chocolate',
      description:
        'Plant protein from roasted chickpeas with cocoa. A chocolate shake that happens to be plant-based.',
    },
  }),
];

export const SEED_SETTINGS = {
  shipping: {
    DE: {
      fee: 499,
      freeFrom: null,
      eta: { de: '2 bis 4 Werktage', en: '2 to 4 working days' },
      carrier: 'DHL',
    },
    GB: {
      fee: 1199,
      freeFrom: null,
      eta: { de: '4 bis 7 Werktage', en: '4 to 7 working days' },
      carrier: 'DHL',
    },
  },
  bundles: [
    {
      id: 'box-8',
      sku: 'EV-BOX-08',
      size: 8,
      price: 2392,
      active: true,
      name: { de: 'Makhana Box mit 8 Packungen', en: 'Makhana Box of 8' },
    },
    {
      id: 'box-16',
      sku: 'EV-BOX-16',
      size: 16,
      price: 4784,
      active: true,
      name: { de: 'Makhana Box mit 16 Packungen', en: 'Makhana Box of 16' },
    },
  ],
  story: {
    isPlaceholder: true,
    de: {
      eyebrow: 'Unsere Geschichte',
      title: 'Von indischen Teichen in deine Snackschublade.',
      paragraphs: [
        'Makhana wächst in den flachen Teichen von Bihar im Osten Indiens. Die Samen der Wasserlilie werden von Hand geerntet, getrocknet und über dem Feuer gepoppt. So entsteht ein Snack, den Familien in Indien seit Generationen lieben.',
        'Mit Earthveda Essentials bringen wir diese Tradition nach Europa: schonend geröstet statt frittiert, kräftig gewürzt und in Packungen, die in jede Tasche passen. Dazu kommt unser Plant Protein aus gerösteten Kichererbsen, ein Shake mit Wurzeln in der indischen Küche.',
        'Hier erzählen wir bald ausführlicher, wer wir sind und warum wir tun, was wir tun.',
      ],
      signature: 'Das Earthveda Team',
    },
    en: {
      eyebrow: 'Our story',
      title: 'From Indian ponds to your snack drawer.',
      paragraphs: [
        'Makhana grows in the shallow ponds of Bihar in eastern India. The seeds of the water lily are harvested by hand, dried and popped over fire, giving a snack that families in India have loved for generations.',
        'With Earthveda Essentials we bring that tradition to Europe: gently roasted instead of fried, boldly seasoned and packed to fit any bag. Alongside it sits our Plant Protein made from roasted chickpeas, a shake with roots in Indian kitchens.',
        'Soon we will tell you more here about who we are and why we do what we do.',
      ],
      signature: 'The Earthveda team',
    },
  },
  business: {
    brand: 'Earthveda Essentials',
    legalName: '',
    legalForm: '',
    street: '',
    postalCode: '',
    city: '',
    country: 'Deutschland',
    email: '',
    phone: '',
    managingDirectors: '',
    registerCourt: '',
    registerNumber: '',
    vatId: '',
    ukVatNumber: '',
    contentResponsible: '',
    packagingRegister: '',
    foodBusinessOperator: '',
    instagram: 'https://www.instagram.com/earthvedaessentials.de/',
    supportHours: { de: 'Mo bis Fr, 9 bis 17 Uhr', en: 'Mon to Fri, 9:00 to 17:00' },
  },
  notifications: {
    merchantEmails: [],
    merchantWhatsApp: [],
  },
  newsletter: {
    welcomeCode: '',
    incentive: {
      de: 'Melde dich an und erhalte 10 % auf deine erste Bestellung.',
      en: 'Sign up and get 10% off your first order.',
    },
  },
};
