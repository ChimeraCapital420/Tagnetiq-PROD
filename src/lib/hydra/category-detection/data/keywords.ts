// FILE: src/lib/hydra/category-detection/data/keywords.ts
// HYDRA v8.0 - Category Keyword Definitions
// Pure data: keyword arrays for each category.
// Used by keyword-scoring detector. Longer phrases score higher.
//
// HOW TO ADD: Just add keywords to existing arrays or create new category entries.

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  // ==================== STAMPS ====================
  stamps: [
    'stamp', 'postage', 'postage stamp', 'first day cover', 'fdc',
    'mint stamp', 'used stamp', 'stamp sheet', 'stamp block',
    'commemorative stamp', 'definitive stamp', 'airmail stamp',
    'revenue stamp', 'overprint', 'perforation', 'imperforate',
    'souvenir sheet', 'miniature sheet', 'stamp booklet',
    'philately', 'philatelic', 'cancellation', 'postmark',
    'scott catalog', 'michel catalog', 'yvert catalog', 'stanley gibbons',
  ],

  // ==================== POSTCARDS ====================
  postcards: [
    'postcard', 'post card', 'vintage postcard', 'real photo postcard',
    'rppc', 'chrome postcard', 'linen postcard', 'greetings card',
    'picture postcard', 'topographical postcard',
  ],

  // ==================== MEDALS ====================
  medals: [
    'medal', 'medallion', 'military medal', 'commemorative medal',
    'bronze medal', 'silver medal', 'gold medal', 'service medal',
    'campaign medal', 'order', 'decoration', 'cross of merit',
  ],

  // ==================== TOKENS ====================
  tokens: [
    'token', 'transit token', 'arcade token', 'trade token',
    'casino token', 'casino chip', 'parking token', 'toll token',
    'telephone token', 'exonumia',
  ],

  // ==================== PINS ====================
  pins: [
    'pin', 'enamel pin', 'lapel pin', 'pin badge', 'badge',
    'olympic pin', 'disney pin', 'trading pin', 'hat pin',
    'collector pin', 'souvenir pin', 'military pin',
  ],

  // ==================== PATCHES ====================
  patches: [
    'patch', 'embroidered patch', 'iron-on patch', 'sew-on patch',
    'military patch', 'scout patch', 'merit badge', 'morale patch',
    'unit patch', 'squadron patch',
  ],

  // ==================== STICKERS ====================
  stickers: [
    'sticker', 'decal', 'panini sticker', 'sticker album',
    'bumper sticker', 'vinyl sticker', 'die cut sticker',
    'sticker pack', 'collectible sticker',
  ],

  // ==================== KEYCHAINS ====================
  keychains: [
    'keychain', 'key chain', 'key ring', 'keyring', 'key fob',
    'souvenir keychain', 'collector keychain',
  ],

  // ==================== MAGNETS ====================
  magnets: [
    'magnet', 'fridge magnet', 'refrigerator magnet', 'souvenir magnet',
    'collector magnet', 'travel magnet',
  ],

  // ==================== TICKETS ====================
  tickets: [
    'ticket', 'concert ticket', 'event ticket', 'movie ticket',
    'stub', 'ticket stub', 'admission ticket', 'lottery ticket',
    'transit ticket', 'airline ticket', 'vintage ticket',
  ],

  // ==================== PHONE CARDS ====================
  phonecards: [
    'phone card', 'phonecard', 'calling card', 'telephone card',
    'prepaid phone', 'telecarte', 'chip card',
  ],

  // ==================== BEVERAGE COLLECTIBLES ====================
  beer_coasters: [
    'beer coaster', 'beermat', 'beer mat', 'coaster', 'drink coaster',
    'brewery coaster', 'bar coaster',
  ],

  bottlecaps: [
    'bottle cap', 'bottlecap', 'crown cap', 'beer cap',
    'soda cap', 'bottle top',
  ],

  // ==================== KIDS MEAL TOYS ====================
  kids_meal_toys: [
    'happy meal', 'happy meal toy', 'mcdonalds toy', "mcdonald's toy",
    'kids meal toy', 'burger king toy', 'fast food toy',
    'cereal toy', 'kinder surprise', 'kinder egg',
  ],

  // ==================== STREETWEAR / HYPE BRANDS ====================
  streetwear: [
    'supreme', 'supreme box logo', 'supreme bogo', 'supreme hoodie', 'supreme tee',
    'supreme jacket', 'supreme beanie', 'supreme cap',
    'bape', 'a bathing ape', 'bathing ape', 'bape hoodie', 'bape shark',
    'baby milo', 'bape camo', 'bape sta',
    'off-white', 'off white', 'offwhite', 'virgil abloh',
    'fear of god', 'fog essentials', 'essentials hoodie', 'essentials sweatpants',
    'jerry lorenzo',
    'kith', 'kith treats', 'ronnie fieg',
    'palace skateboards', 'palace hoodie', 'palace tee', 'tri-ferg',
    'travis scott', 'cactus jack', 'astroworld', 'utopia merch',
    'yeezy gap', 'yeezy season', 'yzy gap',
    'stussy', 'stüssy',
    'anti social social club', 'assc',
    'vlone', 'v lone',
    'chrome hearts',
    'gallery dept', 'gallerydept',
    'rhude', 'amiri',
    'human made', 'nigo',
    'drew house', 'drewhouse',
    'represent clo',
    'corteiz', 'crtz',
    'sp5der', 'spider worldwide',
    'eric emanuel', 'ee shorts',
    'hellstar',
    'broken planet',
    'chinatown market', 'market smiley',
    'billionaire boys club', 'bbc icecream',
    'the hundreds',
    'undefeated', 'undftd',
    'collab', 'collaboration', 'limited edition drop', 'sold out', 'resale',
    'deadstock', 'ds', 'bnwt', 'brand new with tags',
  ],

  // ==================== APPAREL ====================
  apparel: [
    'hoodie', 'hoody', 'sweatshirt', 'sweater', 'pullover', 'crewneck', 'crew neck',
    'jacket', 'coat', 'blazer', 'cardigan', 'windbreaker', 'parka', 'bomber jacket',
    'vest', 'gilet', 'fleece', 'zip up', 'zip-up', 'quarter zip',
    'shirt', 't-shirt', 'tee', 'polo', 'button up', 'button down', 'flannel',
    'tank top', 'henley', 'long sleeve', 'short sleeve',
    'pants', 'jeans', 'shorts', 'joggers', 'sweatpants', 'track pants',
    'trousers', 'chinos', 'khakis', 'cargo pants', 'leggings', 'skirt',
    'dress', 'jumpsuit', 'romper', 'overalls', 'tracksuit', 'onesie',
    'hat', 'cap', 'beanie', 'snapback', 'fitted cap', 'dad hat', 'trucker hat',
    'bucket hat', 'visor', 'headband',
    'scarf', 'gloves', 'mittens', 'socks', 'belt', 'tie', 'bow tie',
    'jersey', 'uniform', 'team jersey', 'basketball jersey', 'football jersey',
    'hockey jersey', 'baseball jersey', 'soccer jersey',
    'avalanche', 'broncos', 'nuggets', 'rockies', 'rapids',
    'nfl', 'nba', 'mlb', 'nhl', 'mls',
    'gucci shirt', 'louis vuitton', 'chanel', 'prada', 'hermes', 'versace',
    'burberry', 'balenciaga', 'givenchy', 'fendi', 'dior',
    'vintage tee', 'vintage shirt', 'band tee', 'concert tee', 'tour shirt',
    'graphic tee', 'vintage jacket', 'varsity jacket', 'letterman jacket',
  ],

  // ==================== SNEAKERS ====================
  sneakers: [
    'sneaker', 'sneakers', 'kicks', 'trainers',
    'air jordan', 'jordan 1', 'jordan 3', 'jordan 4', 'jordan 5', 'jordan 6',
    'jordan 11', 'jordan 12', 'jordan 13', 'jordan retro',
    'yeezy', 'yeezy 350', 'yeezy 500', 'yeezy 700', 'yeezy slide', 'yeezy foam',
    'nike dunk', 'dunk low', 'dunk high', 'sb dunk',
    'air force 1', 'af1', 'air force one',
    'air max', 'air max 1', 'air max 90', 'air max 95', 'air max 97',
    'new balance 550', 'new balance 990', 'new balance 2002r',
    'adidas samba', 'adidas gazelle', 'adidas superstar', 'adidas stan smith',
    'converse', 'chuck taylor', 'vans old skool', 'vans sk8',
    'asics gel', 'nike blazer', 'puma suede',
    'deadstock', 'ds shoes', 'vnds', 'og all',
    'travis scott', 'off-white nike', 'union jordan',
    'stockx', 'goat app',
  ],

  // ==================== HOUSEHOLD ====================
  household: [
    'appliance', 'kitchen', 'blender', 'mixer', 'coffee maker', 'keurig', 'nespresso',
    'instant pot', 'air fryer', 'toaster', 'microwave', 'food processor', 'juicer',
    'vacuum', 'dyson', 'roomba', 'shark', 'bissell', 'hoover', 'mop', 'steam cleaner',
    'vitamix', 'cuisinart', 'kitchenaid', 'ninja', 'hamilton beach', 'black decker',
    'baby monitor', 'car seat', 'stroller', 'pack n play', 'high chair', 'crib',
    'pet feeder', 'litter box', 'aquarium', 'dog bed', 'cat tree',
    'new in box', 'nib', 'sealed', 'factory sealed', 'unopened',
    'walmart', 'target', 'costco', 'amazon basics',
  ],

  // ==================== VEHICLES ====================
  vehicles: [
    'vehicle', 'automobile', 'automotive', 'sedan', 'coupe', 'hatchback',
    'truck', 'pickup', 'suv', 'crossover', 'minivan', 'wagon',
    'motorcycle', 'motorbike', 'scooter', 'atv', 'utv',
    'odometer', 'mileage', 'title', 'carfax',
    'ford', 'chevrolet', 'chevy', 'toyota', 'honda', 'nissan', 'dodge', 'ram',
    'jeep', 'gmc', 'bmw', 'mercedes', 'audi', 'lexus', 'acura', 'infiniti',
    'volkswagen', 'subaru', 'mazda', 'hyundai', 'kia', 'tesla', 'rivian', 'lucid',
    'porsche', 'ferrari', 'lamborghini', 'maserati', 'bentley', 'rolls royce',
    'mustang', 'camaro', 'corvette', 'challenger', 'charger', 'wrangler',
    'f-150', 'f150', 'silverado', 'sierra', 'ram 1500', 'tacoma', 'tundra',
    'civic', 'accord', 'camry', 'corolla', 'altima', 'maxima', 'sentra',
    'model s', 'model 3', 'model x', 'model y', 'cybertruck',
    'harley davidson', 'harley', 'indian motorcycle', 'ducati', 'kawasaki', 'suzuki',
  ],

  // ==================== COINS ====================
  coins: [
    'coin', 'penny', 'nickel', 'dime', 'quarter', 'dollar', 'cent',
    'morgan', 'liberty', 'eagle', 'buffalo', 'wheat', 'mercury',
    'numismatic', 'mint', 'uncirculated', 'proof', 'silver dollar',
    'gold coin', 'half dollar', 'commemorative', 'bullion',
    'currency', 'banknote', 'note', 'bill', 'peace dollar',
    'walking liberty', 'standing liberty', 'seated liberty',
    'barber', 'indian head', 'flying eagle', 'trade dollar',
    'double eagle', 'gold eagle', 'silver eagle', 'platinum eagle',
    'krugerrand', 'maple leaf', 'britannia', 'philharmonic',
    'ancient coin', 'roman coin', 'greek coin', 'byzantine',
    'ms63', 'ms64', 'ms65', 'ms66', 'ms67', 'ms68', 'ms69', 'ms70',
    'pcgs', 'ngc', 'anacs', 'icg', 'mint state', 'proof coin',
  ],

  // ==================== LEGO ====================
  lego: [
    'lego', 'legos', 'brick', 'minifig', 'minifigure',
    'star wars lego', 'technic', 'creator', 'ninjago',
    'city lego', 'friends lego', 'duplo', 'bionicle',
    'millennium falcon', 'death star', 'hogwarts', 'batman lego',
    'marvel lego', 'architecture', 'ideas lego', 'creator expert',
  ],

  // ==================== POKEMON CARDS ====================
  pokemon_cards: [
    'pokemon', 'pokémon', 'poke mon', 'poké',
    'pikachu', 'charizard', 'blastoise', 'venusaur', 'mewtwo', 'mew',
    'bulbasaur', 'charmander', 'squirtle', 'eevee', 'snorlax', 'gengar',
    'dragonite', 'gyarados', 'alakazam', 'machamp', 'arcanine', 'lapras',
    'vaporeon', 'jolteon', 'flareon', 'espeon', 'umbreon', 'leafeon', 'glaceon', 'sylveon',
    'articuno', 'zapdos', 'moltres', 'lugia', 'ho-oh', 'celebi',
    'rayquaza', 'groudon', 'kyogre', 'dialga', 'palkia', 'giratina', 'arceus',
    'vmax', 'vstar', 'v card', 'gx card', 'ex card', 'full art',
    'rainbow rare', 'secret rare', 'shiny', 'holo', 'holographic',
    'reverse holo', 'promo', 'trainer gallery', 'alt art',
    'illustration rare', 'special art', 'gold star', 'shining',
    'base set', 'jungle', 'fossil', 'team rocket',
  ],

  // ==================== TRADING CARDS ====================
  trading_cards: [
    'trading card', 'tcg', 'holographic', 'foil card',
    'first edition', 'psa', 'graded card', 'booster', 'pack',
    'cgc', 'bgs', 'beckett', 'card game',
  ],

  // ==================== SPORTS CARDS ====================
  sports_cards: [
    'topps', 'panini', 'rookie card', 'sports card', 'baseball card',
    'football card', 'basketball card', 'hockey card', 'prizm', 'select',
    'optic', 'mosaic', 'donruss', 'bowman', 'upper deck',
  ],

  // ==================== BOOKS ====================
  books: [
    'book', 'novel', 'hardcover', 'paperback', 'first edition book',
    'signed copy', 'isbn', 'author', 'rare book', 'antique book',
    'leather bound', 'dust jacket', 'manuscript',
  ],

  // ==================== COMICS ====================
  comics: [
    'comic', 'comic book', 'graphic novel', 'manga', 'issue',
    'marvel', 'dc comics', 'spider-man', 'batman', 'superman', 'x-men',
    'first appearance', 'key issue', 'cgc', 'cbcs', 'graded comic',
    'golden age', 'silver age', 'bronze age', 'modern age',
    'variant cover', 'newsstand', 'direct edition',
  ],

  // ==================== VIDEO GAMES ====================
  video_games: [
    'video game', 'game', 'nintendo', 'playstation', 'xbox', 'ps5', 'ps4', 'ps3', 'ps2',
    'switch', 'wii', 'gamecube', 'n64', 'snes', 'nes', 'gameboy', 'game boy',
    'sega', 'genesis', 'dreamcast', 'atari', 'steam', 'pc game',
    'sealed game', 'cib', 'complete in box', 'cartridge', 'disc',
    'zelda', 'mario', 'final fantasy', 'call of duty', 'halo',
  ],

  // ==================== VINYL RECORDS ====================
  vinyl_records: [
    'vinyl', 'record', 'lp', 'album', '45 rpm', '33 rpm', '78 rpm',
    'first pressing', 'original pressing', 'limited edition vinyl',
    'picture disc', 'colored vinyl', 'audiophile', 'mono', 'stereo',
    'discogs', 'rare vinyl', 'sealed vinyl', 'mint vinyl',
  ],

  // ==================== ELECTRONICS ====================
  electronics: [
    'electronic', 'gadget', 'device', 'speaker', 'headphone', 'earbuds',
    'tablet', 'laptop', 'computer', 'monitor', 'keyboard', 'mouse',
    'smart home', 'alexa', 'echo', 'google home', 'ring doorbell',
    'gopro', 'drone', 'camera', 'lens',
  ],

  // ==================== WATCHES & JEWELRY ====================
  watches: ['watch', 'rolex', 'omega', 'seiko', 'casio', 'timepiece', 'wristwatch'],
  jewelry: ['jewelry', 'necklace', 'bracelet', 'ring', 'earring', 'gold', 'silver', 'diamond'],

  // ==================== TOYS & COLLECTIBLES ====================
  toys: ['toy', 'action figure', 'doll', 'plush', 'stuffed animal'],
  action_figures: ['action figure', 'figure', 'statue', 'funko', 'pop vinyl', 'hot toys'],
  collectibles: ['collectible', 'collector', 'rare', 'limited edition'],
  antiques: ['antique', 'victorian', 'art deco', 'edwardian'],
  vintage: ['vintage', 'retro', 'mid-century'],
};