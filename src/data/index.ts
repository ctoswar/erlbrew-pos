import { Staff, MenuItem, Category } from "../types";

export const STAFF: Staff[] = [
  { rfid: "RF001", pin: "1234", name: "Jane Dela Cruz",  role: "Senior Barista",   initials: "JD", color: "#C9873A" },
  { rfid: "RF002", pin: "5678", name: "Marco Santos",    role: "Barista",           initials: "MS", color: "#6e9e6a" },
  { rfid: "RF003", pin: "9012", name: "Ana Reyes",       role: "Shift Supervisor",  initials: "AR", color: "#7a6eb0" },
  { rfid: "RF004", pin: "3456", name: "Luis Garcia",     role: "Manager",           initials: "LG", color: "#b06e6e" },
];

export const MENU: MenuItem[] = [
  // Signature Brews
  { id: "m1",  name: "Smoked Sea Salt Mocha",    category: "Signature Brews", price: 6.75, badge: "SIGNATURE",   description: "Single-origin dark chocolate, espresso, steamed oat milk, topped with house-smoked Maldon sea salt.", emoji: "☕", popular: true },
  { id: "m2",  name: "Velvet Matcha Latte",       category: "Signature Brews", price: 6.25, badge: "SIGNATURE",   description: "Ceremonial grade Uji matcha whisked with Madagascar vanilla bean and creamy macadamia milk.",        emoji: "🍵", popular: true },
  { id: "m3",  name: "Honey Lavender Cortado",   category: "Signature Brews", price: 5.50, badge: "SIGNATURE",   description: "Local wildflower honey, dried culinary lavender, and a double shot of our house Heritage roast.",    emoji: "🌼" },
  { id: "m4",  name: "Cold Brew Reserve",         category: "Signature Brews", price: 5.75, badge: "HAND-POURED", description: "24-hour slow steeped concentrate. Served over a single clear ice sphere.",                          emoji: "🧊", popular: true },
  // Espresso
  { id: "m5",  name: "Heritage Double Espresso", category: "Espresso",        price: 4.00, badge: "CLASSIC",     description: "Two shots of our house Heritage blend. Clean, balanced, with a honey-toned finish.",               emoji: "☕" },
  { id: "m6",  name: "Flat White",               category: "Espresso",        price: 4.75, badge: "CLASSIC",     description: "Velvety micro-foam poured over a ristretto double shot.",                                         emoji: "☕" },
  { id: "m7",  name: "Spiced Americano",          category: "Espresso",        price: 4.25, badge: "SEASONAL",    description: "Cardamom and Ceylon cinnamon infused hot water, finished with a Heritage espresso shot.",           emoji: "🫖" },
  { id: "m8",  name: "Macchiato Lungo",           category: "Espresso",        price: 4.50, badge: "CLASSIC",     description: "Long pull espresso with a delicate cloud of steamed milk.",                                       emoji: "☕" },
  // Pastries
  { id: "m9",  name: "Kouign-Amann",              category: "Pastries",        price: 4.25, badge: "BAKED DAILY", description: "Buttery, caramelized Breton pastry. Crisp outside, tender within.",                               emoji: "🥐", popular: true },
  { id: "m10", name: "Cardamom Knot",             category: "Pastries",        price: 3.75, badge: "BAKED DAILY", description: "Soft brioche twisted with house-ground cardamom sugar.",                                          emoji: "🍞" },
  { id: "m11", name: "Almond Financier",          category: "Pastries",        price: 3.50, badge: "BAKED DAILY", description: "Brown butter almond cake with flaked Marcona almonds on top.",                                   emoji: "🧁" },
  { id: "m12", name: "Seasonal Tart",             category: "Pastries",        price: 5.00, badge: "SEASONAL",    description: "Chef's daily selection using locally sourced seasonal produce.",                                  emoji: "🥧" },
  // Cold Drinks
  { id: "m13", name: "Hibiscus Fizz",             category: "Cold Drinks",     price: 5.25, badge: "HOUSE-MADE",  description: "Dried hibiscus flowers steeped overnight with citrus zest, topped with sparkling water.",          emoji: "🌺" },
  { id: "m14", name: "Cascara Lemonade",          category: "Cold Drinks",     price: 5.50, badge: "RARE",        description: "Coffee cherry husks brewed into sweet tea blended with fresh Meyer lemon.",                       emoji: "🍋" },
  { id: "m15", name: "Oat Horchata Cold Brew",    category: "Cold Drinks",     price: 6.00, badge: "SIGNATURE",   description: "House oat horchata swirled through our cold brew concentrate. Creamy, nutty, mellow.",            emoji: "🥤", popular: true },
  { id: "m16", name: "Still Water",               category: "Cold Drinks",     price: 1.50, badge: "",            description: "Filtered still water.",                                                                          emoji: "💧" },
];

export const CATEGORIES: Category[] = ["Signature Brews", "Espresso", "Pastries", "Cold Drinks"];
