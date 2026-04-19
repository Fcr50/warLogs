const COC = 'https://coc.guide/static/imgs';
const DC  = 'https://cdn.discordapp.com/emojis';
const SZ  = '?size=64';

export const HERO_IMAGES = {
  'Barbarian King': `${COC}/hero/barbarian-king.png`,
  'Archer Queen':   `${COC}/hero/archer-queen.png`,
  'Grand Warden':   `${COC}/hero/grand-warden.png`,
  'Royal Champion': `${COC}/hero/royal-champion.png`,
  'Minion Prince':  null,
  'Dragon Duke':    null,
};

export const HERO_COLORS = {
  'Barbarian King': '#c0392b',
  'Archer Queen':   '#8e44ad',
  'Grand Warden':   '#2980b9',
  'Royal Champion': '#d35400',
  'Minion Prince':  '#1a252f',
  'Dragon Duke':    '#f39c12',
};

export const HERO_SHORT = {
  'Barbarian King': 'BK',
  'Archer Queen':   'AQ',
  'Grand Warden':   'GW',
  'Royal Champion': 'RC',
  'Minion Prince':  'MP',
  'Dragon Duke':    'DD',
};

export const EQUIPMENT_IMAGES = {
  // Barbarian King
  'Barbarian Puppet':  `${COC}/equipment/barbarian-crown.png`,
  'Rage Vial':         `${COC}/equipment/iron-fist.png`,
  'Earthquake Boots':  `${COC}/equipment/earthquake-boots.png`,
  'Vampstache':        `${COC}/equipment/vampstache.png`,
  'Giant Gauntlet':    `${COC}/equipment/giant-gauntlet.png`,
  'Spiky Ball':        `${DC}/1234940460070600804.png${SZ}`,
  'Stick Horse':       `${DC}/1470414517191180319.png${SZ}`,
  'Snake Bracelet':    `${COC}/equipment/snake-armor.png`,
  // Archer Queen
  'Archer Puppet':     `${COC}/equipment/archer-crown.png`,
  'Invisibility Vial': `${COC}/equipment/royal-cloak.png`,
  'Giant Arrow':       `${COC}/equipment/piercing-arrow.png`,
  'Healer Puppet':     `${COC}/equipment/healer-jar.png`,
  'Frozen Arrow':      `${COC}/equipment/frozen-arrow.png`,
  'Action Figure':     `${DC}/1401438960294690867.png${SZ}`,
  'Magic Mirror':      `${COC}/equipment/magic-mirror.png`,
  // Grand Warden
  'Eternal Tome':      `${COC}/equipment/eternal-tome.png`,
  'Life Gem':          `${COC}/equipment/life-gem.png`,
  'Healing Tome':      `${COC}/equipment/healing-tome.png`,
  'Rage Gem':          `${COC}/equipment/angry-tome.png`,
  'Lavaloon Puppet':   `${COC}/equipment/gw-lavaloon-puppet.png`,
  'Fireball':          `${COC}/equipment/fire-in-a-can.png`,
  'Heroic Torch':      `${COC}/equipment/heroic-torch.png`,
  // Royal Champion
  'Seeking Shield':    `${COC}/equipment/seeking-shield.png`,
  'Royal Gem':         `${COC}/equipment/protective-cloak.png`,
  'Hog Rider Puppet':  `${COC}/equipment/hog-rider-puppet.png`,
  'Rocket Spear':      `${DC}/1223332521358528695.png${SZ}`,
  'Electro Boots':     `${COC}/equipment/electro-boots.png`,
  'Haste Vial':        `${COC}/equipment/haste-vial.png`,
  'Frost Flake':       `${DC}/1447958238816374919.png${SZ}`,
  // Minion Prince
  'Dark Orb':          `${DC}/1310574234543587358.png${SZ}`,
  'Henchmen Puppet':   `${COC}/equipment/mp-minion-bros.png`,
  'Noble Iron':        `${DC}/1354122575965454347.png${SZ}`,
  'Metal Pants':       `${DC}/1341345439626039337.png${SZ}`,
  'Meteor Staff':      `${DC}/1436061197077315586.png${SZ}`,
  'Dark Crown':        `${DC}/1401438986366484602.png${SZ}`,
  // Dragon Duke
  'Fire Heart':        `${DC}/1483040001116602420.png${SZ}`,
  'Rocket Backpack':   `${DC}/1493662588695740659.png${SZ}`,
  'Stun Blaster':      `${DC}/1483040038789841040.png${SZ}`,
  'Flame Blower':      `${DC}/1493665431611904221.png${SZ}`,
};

// Which equipment belongs to each hero (for grouping in the UI)
export const HERO_EQUIPMENT_MAP = {
  'Barbarian King': [
    'Barbarian Puppet', 'Rage Vial', 'Earthquake Boots', 'Vampstache',
    'Giant Gauntlet', 'Spiky Ball', 'Stick Horse', 'Snake Bracelet',
  ],
  'Archer Queen': [
    'Archer Puppet', 'Invisibility Vial', 'Giant Arrow', 'Healer Puppet',
    'Frozen Arrow', 'Action Figure', 'Magic Mirror',
  ],
  'Grand Warden': [
    'Eternal Tome', 'Life Gem', 'Healing Tome', 'Rage Gem',
    'Lavaloon Puppet', 'Fireball', 'Heroic Torch',
  ],
  'Royal Champion': [
    'Seeking Shield', 'Royal Gem', 'Hog Rider Puppet', 'Rocket Spear',
    'Electro Boots', 'Haste Vial', 'Frost Flake',
  ],
  'Minion Prince': [
    'Dark Orb', 'Henchmen Puppet', 'Noble Iron', 'Metal Pants',
    'Meteor Staff', 'Dark Crown',
  ],
  'Dragon Duke': ['Fire Heart', 'Rocket Backpack', 'Stun Blaster', 'Flame Blower'],
};
