import React from "react";

import cinnamonRollIcon from "../../svg icon/erlbrew-icons/cinnamon-roll.svg";
import croissantIcon from "../../svg icon/erlbrew-icons/croissant.svg";
import donutIcon from "../../svg icon/erlbrew-icons/donut.svg";
import flowerIcon from "../../svg icon/erlbrew-icons/flower.svg";
import hotCoffeeIcon from "../../svg icon/erlbrew-icons/hot-coffee.svg";
import icedCoffeeIcon from "../../svg icon/erlbrew-icons/iced-coffee.svg";
import icedTeaIcon from "../../svg icon/erlbrew-icons/iced-tea.svg";
import matchaIcon from "../../svg icon/erlbrew-icons/matcha.svg";
import muffinIcon from "../../svg icon/erlbrew-icons/muffin.svg";
import orangeIcon from "../../svg icon/erlbrew-icons/orange.svg";
import pastryBoxIcon from "../../svg icon/erlbrew-icons/pastry-box.svg";
import syrupIcon from "../../svg icon/erlbrew-icons/syrup.svg";
import toastIcon from "../../svg icon/erlbrew-icons/toast.svg";
import waterIcon from "../../svg icon/erlbrew-icons/water.svg";
import waffleIcon from "../../svg icon/erlbrew-icons/waffle.svg";

export interface FoodIcon {
  emoji: string;
  label: string;
  icon: React.ReactNode;
}

const foodIcon = (source: string): React.ReactNode => (
  <img
    src={source}
    alt=""
    aria-hidden="true"
    width="22"
    height="22"
    draggable={false}
    className="block h-[22px] max-h-full max-w-full w-[22px] object-contain"
  />
);

// New emoji keys map to the supplied icon set. Legacy keys are resolved below
// so existing menu records keep their value while receiving the new artwork.
export const FOOD_ICONS: FoodIcon[] = [
  { emoji: "☕", label: "Hot Coffee", icon: foodIcon(hotCoffeeIcon) },
  { emoji: "🍵", label: "Matcha", icon: foodIcon(matchaIcon) },
  { emoji: "🥤", label: "Iced Coffee", icon: foodIcon(icedCoffeeIcon) },
  { emoji: "🧋", label: "Iced Tea", icon: foodIcon(icedTeaIcon) },
  { emoji: "🧇", label: "Waffle", icon: foodIcon(waffleIcon) },
  { emoji: "🥐", label: "Croissant", icon: foodIcon(croissantIcon) },
  { emoji: "🌀", label: "Cinnamon Roll", icon: foodIcon(cinnamonRollIcon) },
  { emoji: "🍞", label: "Toast", icon: foodIcon(toastIcon) },
  { emoji: "🍯", label: "Syrup", icon: foodIcon(syrupIcon) },
  { emoji: "🧁", label: "Muffin", icon: foodIcon(muffinIcon) },
  { emoji: "🍊", label: "Orange", icon: foodIcon(orangeIcon) },
  { emoji: "🍩", label: "Donut", icon: foodIcon(donutIcon) },
  { emoji: "💧", label: "Water", icon: foodIcon(waterIcon) },
  { emoji: "🌼", label: "Flower", icon: foodIcon(flowerIcon) },
  { emoji: "🎁", label: "Pastry Box", icon: foodIcon(pastryBoxIcon) },
];

const LEGACY_EMOJI_ALIASES: Record<string, string> = {
  "🧊": "💧",
  "🫖": "🍵",
  "🥧": "🎁",
  "🍋": "🍊",
  "🌺": "🌼",
};

export const getEmojiIconKey = (emoji: string): string => LEGACY_EMOJI_ALIASES[emoji] || emoji;

export const getIconByEmoji = (emoji: string): React.ReactNode => {
  const found = FOOD_ICONS.find((food) => food.emoji === getEmojiIconKey(emoji));
  return found ? found.icon : <span className="text-lg">{emoji}</span>;
};
