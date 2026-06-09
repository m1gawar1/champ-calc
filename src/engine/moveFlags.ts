// 技フラグ（特性・アイテム効果の適用判定）

export const PUNCH_MOVES = new Set([
  'Bullet Punch', 'Comet Punch', 'Dizzy Punch', 'Double Iron Bash',
  'Drain Punch', 'Dynamic Punch', 'Fire Punch', 'Focus Punch',
  'Hammer Arm', 'Ice Hammer', 'Ice Punch', 'Mach Punch',
  'Mega Punch', 'Meteor Mash', 'Power-Up Punch', 'Shadow Punch',
  'Sky Uppercut', 'Thunder Punch', 'Wicked Blow', 'Surging Strikes',
]);

export const BITE_MOVES = new Set([
  'Bite', 'Crunch', 'Fire Fang', 'Fishious Rend', 'Hyper Fang',
  'Ice Fang', 'Jaw Lock', 'Psychic Fangs', 'Thunder Fang', 'Poison Fang',
]);

export const PULSE_MOVES = new Set([
  'Aura Sphere', 'Dark Pulse', 'Dragon Pulse', 'Heal Pulse',
  'Oblivion Wing', 'Origin Pulse', 'Terrain Pulse', 'Water Pulse',
]);

export const SOUND_MOVES = new Set([
  'Boomburst', 'Bug Buzz', 'Clanging Scales', 'Clangorous Soul',
  'Confide', 'Disarming Voice', 'Echoed Voice', 'Grasswhistle',
  'Growl', 'Hyper Voice', 'Metal Sound', 'Noble Roar', 'Overdrive',
  'Perish Song', 'Relic Song', 'Roar', 'Round', 'Screech', 'Sing',
  'Snarl', 'Snore', 'Sparkling Aria', 'Supersonic', 'Uproar',
]);

export const RECOIL_MOVES = new Set([
  'Brave Bird', 'Double-Edge', 'Flare Blitz', 'Head Charge', 'Head Smash',
  'Light of Ruin', 'Take Down', 'Volt Tackle', 'Wild Charge', 'Wood Hammer',
  'Submission', 'High Jump Kick', 'Jump Kick',
]);

// 非接触の物理技（それ以外の物理技は接触技とみなす）
const NON_CONTACT_PHYSICAL = new Set([
  'Earthquake', 'Magnitude', 'Bulldoze', 'Rock Slide', 'Rock Tomb',
  'Stone Edge', 'Rock Blast', 'Razor Leaf', 'Bullet Seed', 'Seed Bomb',
  'Petal Blizzard', 'Self-Destruct', 'Explosion', 'Heat Crash', 'Heavy Slam',
  'Smart Strike', 'Thousand Arrows', 'Thousand Waves', "Land's Wrath",
  'Aura Wheel', 'Spirit Shackle', 'Poltergeist', 'Fissure',
]);

export function isContact(moveName: string, isPhysical: boolean): boolean {
  if (!isPhysical) return false;
  return !NON_CONTACT_PHYSICAL.has(moveName);
}

// 副作用がある技（ちからずく判定）
const SECONDARY_EFFECT_MOVES = new Set([
  'Air Slash', 'Ancient Power', 'Astonish', 'Bite', 'Blaze Kick',
  'Body Slam', 'Bone Club', 'Bounce', 'Bubble Beam', 'Charge Beam',
  'Confusion', 'Crunch', 'Dark Pulse', 'Discharge', 'Dragon Breath',
  'Ember', 'Energy Ball', 'Extrasensory', 'Fire Blast', 'Fire Fang',
  'Fire Punch', 'Flamethrower', 'Flash Cannon', 'Focus Blast', 'Force Palm',
  'Gunk Shot', 'Heat Wave', 'Hurricane', 'Hyper Fang', 'Ice Beam',
  'Ice Fang', 'Ice Punch', 'Icicle Crash', 'Iron Head', 'Iron Tail',
  'Lava Plume', 'Liquidation', 'Low Sweep', 'Metal Claw', 'Mirror Shot',
  'Moonblast', 'Mud-Slap', 'Muddy Water', 'Night Shade', 'Ominous Wind',
  'Poison Jab', 'Power Whip', 'Psychic', 'Rock Climb', 'Rock Slide',
  'Rock Smash', 'Scald', 'Seed Flare', 'Shadow Ball', 'Silver Wind',
  'Sludge Bomb', 'Sludge Wave', 'Snore', 'Sparkling Aria', 'Stomp',
  'Stone Edge', 'Thunder', 'Thunder Fang', 'Thunder Punch', 'Thunderbolt',
  'Tri Attack', 'Twister', 'Waterfall', 'Wild Charge',
]);

export function hasSecondaryEffect(moveName: string): boolean {
  return SECONDARY_EFFECT_MOVES.has(moveName);
}

// 威力が段階的に増える連続技（各ヒットの威力リスト）
export const ESCALATING_POWER_MOVES: Record<string, number[]> = {
  'Triple Axel': [20, 40, 60],
  'Triple Kick': [10, 20, 30],
};

// 連続技（英語名 → ヒット数範囲）
export const MULTI_HIT_MOVES: Record<string, { min: number; max: number }> = {
  // 2〜5回ランダム
  'Bullet Seed':      { min: 2, max: 5 },
  'Rock Blast':       { min: 2, max: 5 },
  'Icicle Spear':     { min: 2, max: 5 },
  'Pin Missile':      { min: 2, max: 5 },
  'Tail Slap':        { min: 2, max: 5 },
  'Water Shuriken':   { min: 2, max: 5 },
  'Fury Swipes':      { min: 2, max: 5 },
  'Fury Attack':      { min: 2, max: 5 },
  'Scale Shot':       { min: 2, max: 5 },
  'Bone Rush':        { min: 2, max: 5 },
  'Spike Cannon':     { min: 2, max: 5 },
  'Arm Thrust':       { min: 2, max: 5 },
  'Barrage':          { min: 2, max: 5 },
  'Comet Punch':      { min: 2, max: 5 },
  'Double Slap':      { min: 2, max: 5 },
  // 固定2回
  'Double Kick':      { min: 2, max: 2 },
  'Bonemerang':       { min: 2, max: 2 },
  'Double Hit':       { min: 2, max: 2 },
  'Dual Chop':        { min: 2, max: 2 },
  'Twineedle':        { min: 2, max: 2 },
  'Gear Grind':       { min: 2, max: 2 },
  'Dragon Darts':     { min: 2, max: 2 },
  'Dual Wingbeat':    { min: 2, max: 2 },
  'Double Iron Bash': { min: 2, max: 2 },
  // 固定3回
  'Triple Kick':      { min: 3, max: 3 },
  'Triple Axel':      { min: 3, max: 3 },
  'Surging Strikes':  { min: 3, max: 3 },
};
