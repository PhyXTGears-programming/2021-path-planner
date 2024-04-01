import { clamp } from './util.js';

/**
 * @typedef {string} HexColor
 *
 * @typedef {object} Color
 * @hasProperty {number} red   - red component of color [0..1].
 * @hasProperty {number} green - green component of color [0..1].
 * @hasProperty {number} blue  - blue component of color [0..1].
 * @hasProperty {number} alpha - alpha component of color [0..1].
 *
 * @typedef {object} Style
 * @hasProperty {HexColor} primary   - primary color.
 * @hasProperty {HexColor} secondary - secondary color.
 */

const ColorPrototype = {
  /**
   * @param {HexColor} tint
   * @returns {Color}
   */
  tint(tint) {
    const { red, green, blue, alpha } = Color.fromHex(tint);

    return Color(
      (red   + this.red  ) / 2,
      (green + this.green) / 2,
      (blue  + this.blue ) / 2,
      (alpha + this.alpha) / 2
    );
  },

  toHex() {
    const red   = Math.floor(this.red   * 255).toString(16);
    const green = Math.floor(this.green * 255).toString(16);
    const blue  = Math.floor(this.blue  * 255).toString(16);
    const alpha = Math.floor(this.alpha * 255).toString(16);

    return `#${red}${green}${blue}${alpha}`;
  }
};

/**
 * @class
 * @param {number} red
 * @param {number} green
 * @param {number} blue
 * @param {number} alpha
 */
export const Color = (red, green, blue, alpha) => {
  const self = Object.create(ColorPrototype);
  return Object.assign(
    self,
    {
      red:   clamp(red,   0.0, 1.0),
      green: clamp(green, 0.0, 1.0),
      blue:  clamp(blue,  0.0, 1.0),
      alpha: clamp(alpha, 0.0, 1.0)
    });
}

/**
 * @param {HexColor} hex - An HTML hex string color.
 * @returns {Color} A {Color} representation of the hex color or {Color.BLACK} if hex color is invalid.
 */
Color.fromHex = (hex) => {
  if (hex[0] !== '#') {
    return Colors.BLACK;
  }

  switch (hex.length) {
    case 4: {
      // #rgb
      const red   = clamp(parseInt(hex[1], 16) / 15.0, 0.0, 1.0);
      const green = clamp(parseInt(hex[2], 16) / 15.0, 0.0, 1.0);
      const blue  = clamp(parseInt(hex[3], 16) / 15.0, 0.0, 1.0);

      return Color(red, green, blue, 1.0);
    }

    case 5: {
      // #rgba
      const red   = clamp(parseInt(hex[1], 16) / 15.0, 0.0, 1.0);
      const green = clamp(parseInt(hex[2], 16) / 15.0, 0.0, 1.0);
      const blue  = clamp(parseInt(hex[3], 16) / 15.0, 0.0, 1.0);
      const alpha = clamp(parseInt(hex[4], 16) / 15.0, 0.0, 1.0);

      return Color(red, green, blue, alpha);
    }

    case 6: {
      // #rrggbb
      const red   = clamp(parseInt(hex.substr(1, 2), 16) / 255.0, 0.0, 1.0);
      const green = clamp(parseInt(hex.substr(3, 2), 16) / 255.0, 0.0, 1.0);
      const blue  = clamp(parseInt(hex.substr(5, 2), 16) / 255.0, 0.0, 1.0);

      return Color(red, green, blue, 1.0);
    }

    case 7: {
      // #rrggbbaa
      const red   = clamp(parseInt(hex.substr(1, 2), 16) / 255.0, 0.0, 1.0);
      const green = clamp(parseInt(hex.substr(3, 2), 16) / 255.0, 0.0, 1.0);
      const blue  = clamp(parseInt(hex.substr(5, 2), 16) / 255.0, 0.0, 1.0);
      const alpha = clamp(parseInt(hex.substr(7, 2), 16) / 255.0, 0.0, 1.0);

      return Color(red, green, blue, alpha);
    }

    default:
      return Color.BLACK;
  }
}

/**
 * @param {Style} style
 * @param {HexColor} tint
 */
export const tintStyle = (style, tint = '#000f') => {
  let { primary, secondary } = style;

  primary = Color.fromHex(primary).tint(tint).toHex();
  secondary = Color.fromHex(secondary).tint(tint).toHex();

  return { primary, secondary };
}

export const Colors = {
  BLACK: Color(0, 0, 0, 0xff),
};
