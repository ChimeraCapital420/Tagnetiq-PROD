export interface DataSource {
  name: string;
  url: string;
  reason: string;
  api_available: boolean;
}

export interface CategoryData {
  category_id: string;
  subcategory_id: string;
  subcategory_name: string;
  tier_1_sources: DataSource[];
  tier_2_sources: DataSource[];
  tier_3_sources: DataSource[];
  key_valuation_factors: string[];
}

export const dataSources: CategoryData[] = [
  {
    "category_id": "real-estate",
    "subcategory_id": "real-estate-comps",
    "subcategory_name": "Market Comps",
    "tier_1_sources": [
      {
        "name": "ATTOM Data Solutions API",
        "url": "https://api.developer.attomdata.com/docs",
        "reason": "Industry gold standard with 158+ million property records, comprehensive AVM, and official government data integration. Provides nationwide parcel, assessment, sales history with 30TB warehouse.",
        "api_available": true
      },
      {
        "name": "CoreLogic Trestle (RESO Web API)",
        "url": "https://trestle-documentation.corelogic.com/",
        "reason": "Official MLS listing data via industry-standard RESO Web API/Data Dictionary. Authoritative source for active listings and transaction data.",
        "api_available": true
      }
    ],
    "tier_2_sources": [
      {
        "name": "HouseCanary Analytics API",
        "url": "https://www.housecanary.com/resources/developer-tools",
        "reason": "Professional-grade automated valuation models (AVMs), comps selection, and forecasted values via REST API for portfolios.",
        "api_available": true
      },
      {
        "name": "Zillow Group Bridge Public Records API",
        "url": "https://www.zillowgroup.com/developers/api/public-data/public-records-api/",
        "reason": "Parcel, assessment, and transactional public-records coverage across the U.S. via invite-only API access.",
        "api_available": true
      }
    ],
    "tier_3_sources": [
      {
        "name": "County Assessor Open Data APIs",
        "url": "https://www.mcassessor.maricopa.gov/file/home/MC-Assessor-API-Documentation.pdf",
        "reason": "Direct authoritative data from county assessors for ownership and tax history verification.",
        "api_available": true
      },
      {
        "name": "Redfin Data Center",
        "url": "https://www.redfin.com/news/data-center/",
        "reason": "MLS-sourced data with downloadable market reports for backup validation.",
        "api_available": false
      }
    ],
    "key_valuation_factors": [
      "Recent arm's-length sale prices of comparable properties",
      "Property characteristics (beds/baths, GLA, lot size, year built, condition)",
      "Location adjustments (school zones, proximity to amenities/transport)",
      "Market liquidity (days on market, list-to-sale ratios)",
      "Quality and recency of data sources (MLS vs. public record)"
    ]
  },
  {
    "category_id": "real-estate",
    "subcategory_id": "real-estate-rental",
    "subcategory_name": "Rental Analysis",
    "tier_1_sources": [
      {
        "name": "Rentometer API",
        "url": "https://www.rentometer.com/rentometer-api",
        "reason": "Purpose-built rental comps with nearby comparable extraction and CSV exports for rent studies via API.",
        "api_available": true
      },
      {
        "name": "HUD Fair Market Rents (FMR) API",
        "url": "https://www.huduser.gov/portal/dataset/fmr-api.html",
        "reason": "Official government baseline rent levels and income limits for subsidy programs; authoritative rent anchors.",
        "api_available": true
      }
    ],
    "tier_2_sources": [
      {
        "name": "AirDNA API",
        "url": "https://apidocs.airdna.co/",
        "reason": "Short-term rental analytics (ADR, occupancy, revenue) and listing-level data via enterprise API.",
        "api_available": true
      },
      {
        "name": "CoStar",
        "url": "https://www.costar.com/",
        "reason": "Premier commercial real estate data provider with detailed rental comps and market trends.",
        "api_available": true
      }
    ],
    "tier_3_sources": [
      {
        "name": "Zillow Research ZORI/ZORF",
        "url": "https://www.zillow.com/research/data/",
        "reason": "Observed Rent Index and forecasts for macro/micro rent trends with methodological transparency.",
        "api_available": false
      },
      {
        "name": "Apartment List Rent Data",
        "url": "https://www.apartmentlist.com/research/national-rent-data",
        "reason": "Monthly rent estimates, vacancy index, and methodology with free data downloads.",
        "api_available": false
      }
    ],
    "key_valuation_factors": [
      "Comparable unit size, bed/bath count, and amenities",
      "Lease term and concessions (free months, parking, utilities)",
      "Building class/condition and year renovated",
      "Neighborhood demand indicators (vacancy, time-on-market)",
      "Regulatory context (rent control, FMR baselines)"
    ]
  },
  {
    "category_id": "real-estate",
    "subcategory_id": "real-estate-flip",
    "subcategory_name": "Flip Potential",
    "tier_1_sources": [
      {
        "name": "CoreLogic Trestle + MLS (RESO Web API)",
        "url": "https://trestle-documentation.corelogic.com/webapi.html",
        "reason": "Active listings, price cuts, DOM, and listing photos to spot under-market opportunities and ARV comps.",
        "api_available": true
      },
      {
        "name": "HouseCanary Data Explorer/API",
        "url": "https://www.housecanary.com/products/data-explorer",
        "reason": "Professional AVMs, ARV modeling, and market forecasting for pro forma flip analysis.",
        "api_available": true
      }
    ],
    "tier_2_sources": [
      {
        "name": "ATTOM Property Data",
        "url": "https://www.attomdata.com/solutions/flipping/",
        "reason": "Specialized flipping data with ROI calculations by neighborhood and comprehensive property analytics.",
        "api_available": true
      },
      {
        "name": "U.S. Census Building Permits Survey",
        "url": "https://www.census.gov/construction/bps/",
        "reason": "Official local permitting activity trends to gauge supply pipeline and rehab friction via API.",
        "api_available": true
      }
    ],
    "tier_3_sources": [
      {
        "name": "BiggerPockets",
        "url": "https://www.biggerpockets.com/",
        "reason": "Community-driven flip analysis and case studies for market validation.",
        "api_available": false
      },
      {
        "name": "County/City Permit APIs",
        "url": "https://www.mcassessor.maricopa.gov/file/home/MC-Assessor-API-Documentation.pdf",
        "reason": "Property-level permit history to assess prior renovations and scope risk.",
        "api_available": true
      }
    ],
    "key_valuation_factors": [
      "As-is purchase price vs. after-repair value (ARV) spread",
      "Scope of work and hard/soft rehab costs",
      "Time to permit and contractor availability",
      "Local comp velocity (DOM, absorption)",
      "Carrying costs, financing rates, and resale seasonality"
    ]
  },
  {
    "category_id": "vehicles",
    "subcategory_id": "vehicles-vin",
    "subcategory_name": "VIN Scan",
    "tier_1_sources": [
      {
        "name": "NHTSA VIN Decoder API",
        "url": "https://vpic.nhtsa.dot.gov/api/",
        "reason": "Official U.S. government VIN decoding with make/model/engine attributes; authoritative baseline for vehicle specifications.",
        "api_available": true
      },
      {
        "name": "NMVTIS (National Motor Vehicle Title Information System)",
        "url": "https://vehiclehistory.gov/",
        "reason": "Official government database for title, brand, theft, and total loss records via approved providers.",
        "api_available": false
      }
    ],
    "tier_2_sources": [
      {
        "name": "CARFAX Connect API",
        "url": "https://www.carfax.com/",
        "reason": "Industry standard for vehicle history reports with comprehensive dealer integration and damage records.",
        "api_available": true
      },
      {
        "name": "J.D. Power VINoptions",
        "url": "https://www.jdpower.com/business/epianalytics-automotive-intelligence",
        "reason": "Option-level build specs at the 17-digit VIN level for enhanced valuation accuracy.",
        "api_available": true
      }
    ],
    "tier_3_sources": [
      {
        "name": "NICB VINCheck",
        "url": "https://www.nicb.org/vincheck",
        "reason": "Free theft/salvage checks backed by National Insurance Crime Bureau for risk screening.",
        "api_available": false
      },
      {
        "name": "AutoCheck",
        "url": "https://www.autocheck.com/",
        "reason": "Alternative vehicle history service with different data sources for cross-verification.",
        "api_available": true
      }
    ],
    "key_valuation_factors": [
      "Accurate VIN decode to trim/options level",
      "Title brands, theft, and salvage history",
      "Open recalls and safety campaigns",
      "Odometer consistency and fraud indicators"
    ]
  },
  {
    "category_id": "vehicles",
    "subcategory_id": "vehicles-value",
    "subcategory_name": "Market Value",
    "tier_1_sources": [
      {
        "name": "J.D. Power (NADA) Valuation Services",
        "url": "https://www.jdpowervalues.com/api-and-web-services-solutions",
        "reason": "Official NADA dealer-grade used/new values with enterprise Web Services APIs; bank and insurer standard.",
        "api_available": true
      },
      {
        "name": "Black Book APIs",
        "url": "https://www.blackbook.com/api/",
        "reason": "Professional dealer wholesale/retail valuations, residuals, and VIN-specific pricing via commercial APIs.",
        "api_available": true
      }
    ],
    "tier_2_sources": [
      {
        "name": "Kelley Blue Book InfoDriver Web Services",
        "url": "https://b2b.kbb.com/industry-solutions/info-driver-web-service-idws/",
        "reason": "Consumer-trusted values with 90+ years expertise; enterprise partner integrations for trade-in/retail values.",
        "api_available": true
      },
      {
        "name": "Manheim Market Report (MMR)",
        "url": "https://www.manheim.com",
        "reason": "Dealer-only wholesale transaction indices and comps for late-model vehicles from largest auction network.",
        "api_available": true
      }
    ],
    "tier_3_sources": [
      {
        "name": "Vehicle Databases Market Value API",
        "url": "https://vehicledatabases.com/",
        "reason": "Alternative with transparent pricing and state-based valuations for cross-validation.",
        "api_available": true
      },
      {
        "name": "Edmunds (Partner API)",
        "url": "https://www.edmunds.com/industry/press/clarification-edmunds-api-status-no-longer-offering-open-api.html",
        "reason": "Historical industry dataset for specs and valuations via enterprise agreements only.",
        "api_available": false
      }
    ],
    "key_valuation_factors": [
      "Trim/options accuracy from VIN build data",
      "Condition and mileage adjustments",
      "Regional market supply/demand and seasonality",
      "Auction lane vs. retail spread analysis"
    ]
  },
  {
    "category_id": "vehicles",
    "subcategory_id": "vehicles-auction",
    "subcategory_name": "Auction Insights",
    "tier_1_sources": [
      {
        "name": "Manheim Market Report (MMR)",
        "url": "https://www.manheim.com",
        "reason": "Actual wholesale auction transaction prices from the world's largest dealer auction network; industry gold standard.",
        "api_available": true
      },
      {
        "name": "ADESA Analytical Services",
        "url": "https://adesa.com/analytics/",
        "reason": "Major auction platform with comprehensive market analytics, depreciation curves, and wholesale insights.",
        "api_available": true
      }
    ],
    "tier_2_sources": [
      {
        "name": "Copart Analytics",
        "url": "https://www.copart.com",
        "reason": "High-volume salvage auction results for damaged vehicles and parts values; largest salvage network.",
        "api_available": true
      },
      {
        "name": "Hagerty Valuation Tools",
        "url": "https://www.hagerty.com/valuation-tools",
        "reason": "Condition-tier price guides and auction comps for classic/collector segments with insurance backing.",
        "api_available": false
      }
    ],
    "tier_3_sources": [
      {
        "name": "Barrett-Jackson Auction Archives",
        "url": "https://www.barrett-jackson.com/",
        "reason": "High-end collector car auction results for specialty/classic vehicle market trends.",
        "api_available": false
      },
      {
        "name": "IAAI Market Data",
        "url": "https://www.iaai.com/",
        "reason": "Insurance auction trends and damaged vehicle values for total loss assessments.",
        "api_available": false
      }
    ],
    "key_valuation_factors": [
      "Sale type (wholesale lane vs. retail/collector)",
      "Title status and frame/structural history",
      "Condition reports and light grading",
      "Seasonality and event-driven demand patterns"
    ]
  },
  {
    "category_id": "lego",
    "subcategory_id": "lego-set",
    "subcategory_name": "Set Identification",
    "tier_1_sources": [
      {
        "name": "BrickLink Catalog + API",
        "url": "https://www.bricklink.com/v3/api.page",
        "reason": "World's largest LEGO marketplace with community-curated canonical catalog for sets, minifigs, and parts.",
        "api_available": true
      },
      {
        "name": "Brickset API",
        "url": "https://brickset.com/article/52664/brickset-api-version-3",
        "reason": "Comprehensive official set database with inventories, release metadata, and robust public API.",
        "api_available": true
      }
    ],
    "tier_2_sources": [
      {
        "name": "Rebrickable API",
        "url": "https://rebrickable.com/api/",
        "reason": "Set/part relationships, color IDs, and build-compatibility analysis via comprehensive REST API.",
        "api_available": true
      },
      {
        "name": "BrickEconomy API",
        "url": "https://www.brickeconomy.com/api-reference",
        "reason": "Specialized LEGO set pricing, market values, and investment tracking with trend analysis.",
        "api_available": true
      }
    ],
    "tier_3_sources": [
      {
        "name": "LEGO Customer Service Building Instructions",
        "url": "https://www.lego.com/en-us/service/buildinginstructions",
        "reason": "Official LEGO source for confirming set numbers, versions, and inventory variations.",
        "api_available": false
      },
      {
        "name": "Peeron LEGO Inventory",
        "url": "http://peeron.com/",
        "reason": "Long-running historical database with detailed set inventories for legacy verification.",
        "api_available": false
      }
    ],
    "key_valuation_factors": [
      "Set completeness (minifigs, printed parts, box, manuals)",
      "Set condition (sealed/new vs. used, box grade)",
      "Retirement status and production rarity",
      "Theme/collector demand (UCS, Ideas, Modulars, exclusives)"
    ]
  },
  {
    "category_id": "lego",
    "subcategory_id": "lego-parts",
    "subcategory_name": "Bulk Parts Value",
    "tier_1_sources": [
      {
        "name": "BrickLink Price Guide (Parts)",
        "url": "https://www.bricklink.com",
        "reason": "Transaction-based part-level pricing across new/used conditions and global regions; most comprehensive.",
        "api_available": true
      },
      {
        "name": "Rebrickable Part Catalog/API",
        "url": "https://rebrickable.com/api/",
        "reason": "Normalized part IDs and color mappings for deduplication and accurate lot valuation analysis.",
        "api_available": true
      }
    ],
    "tier_2_sources": [
      {
        "name": "BrickEconomy Part Valuation",
        "url": "https://www.brickeconomy.com/parts",
        "reason": "Specialized price trend tracking for rare and common parts with market analysis.",
        "api_available": true
      },
      {
        "name": "Brick Owl Parts API",
        "url": "https://www.brickowl.com/api_docs",
        "reason": "Alternative marketplace with competitive pricing data and bulk calculation tools.",
        "api_available": true
      }
    ],
    "tier_3_sources": [
      {
        "name": "LEGO Pick a Brick",
        "url": "https://www.lego.com/en-us/pick-and-build/pick-a-brick",
        "reason": "Official current retail prices for in-production parts as baseline reference.",
        "api_available": false
      },
      {
        "name": "BrickStock Software",
        "url": "https://www.brickstock.com/",
        "reason": "Inventory management tool with integrated market data for parts analysis.",
        "api_available": false
      }
    ],
    "key_valuation_factors": [
      "Part design ID and color rarity combinations",
      "Condition assessment (new vs used quality)",
      "Print variations and mold differences",
      "Bulk discount thresholds and lot composition"
    ]
  },
  {
    "category_id": "lego",
    "subcategory_id": "lego-minifig",
    "subcategory_name": "Minifigure Value",
    "tier_1_sources": [
      {
        "name": "BrickLink Minifigure Catalog",
        "url": "https://www.bricklink.com",
        "reason": "Definitive minifigure identification, variants, and part inventories with transaction-based pricing.",
        "api_available": true
      },
      {
        "name": "Rebrickable Minifig Endpoints",
        "url": "https://rebrickable.com/api/",
        "reason": "API endpoints to map minifigs to parts/sets for comprehensive scarcity and rarity analysis.",
        "api_available": true
      }
    ],
    "tier_2_sources": [
      {
        "name": "Minifigure Price Guide",
        "url": "https://www.minifigpriceguide.com/",
        "reason": "Specialized tracking tool focused exclusively on minifigure-only sales and valuations.",
        "api_available": true
      },
      {
        "name": "BrickEconomy Minifigure Trends",
        "url": "https://www.brickeconomy.com/",
        "reason": "Market value tracking and investment analysis specifically for collectible minifigures.",
        "api_available": true
      }
    ],
    "tier_3_sources": [
      {
        "name": "Brickset Minifigure Database",
        "url": "https://brickset.com/minifigs",
        "reason": "Photos, release info, and set appearances for provenance confirmation.",
        "api_available": false
      },
      {
        "name": "LEGO Minifigure Series Official",
        "url": "https://www.lego.com/en-us/themes/minifigures",
        "reason": "Official source for minifigure series information and release details.",
        "api_available": false
      }
    ],
    "key_valuation_factors": [
      "Variant correctness (prints, accessories, headgear)",
      "Condition assessment (cracks, stress marks, play wear)",
      "Rarity classification (event exclusives, SDCC, employee gifts)",
      "Theme popularity cycles and character significance"
    ]
  },
  {
    "category_id": "starwars",
    "subcategory_id": "starwars-figures",
    "subcategory_name": "Action Figures",
    "tier_1_sources": [
      {
        "name": "Rebelscum Photo Archive",
        "url": "https://www.rebelscum.com/PhotoArchive.asp",
        "reason": "Authoritative visual identification guide for Star Wars action figure variations across all eras.",
        "api_available": false
      },
      {
        "name": "Star Wars Tracker",
        "url": "https://www.starwarstracker.com/",
        "reason": "Dedicated market tracker and price guide for vintage Kenner toys with historical sales data.",
        "api_available": false
      }
    ],
    "tier_2_sources": [
      {
        "name": "Jedi Temple Archives Visual Guides",
        "url": "https://www.jeditemplearchives.com/content/category/10/16/20/",
        "reason": "Extensive checklists and 'first release' details for modern action figure lines.",
        "api_available": false
      },
      {
        "name": "Action Figure Archive",
        "url": "https://www.actionfigurearchive.com/star-wars/",
        "reason": "Detailed production run data and comprehensive variant identification database.",
        "api_available": true
      }
    ],
    "tier_3_sources": [
      {
        "name": "The Star Wars Collectors Archive (SWCA)",
        "url": "https://theswca.com/",
        "reason": "Scholarly archive for vintage prototypes/variants with context for high-end valuations.",
        "api_available": false
      },
      {
        "name": "Hake's Auctions Prices Realized",
        "url": "https://www.hakes.com/Auction/PastAuctions",
        "reason": "Pop-culture auction house with extensive Star Wars realized price archives.",
        "api_available": false
      }
    ],
    "key_valuation_factors": [
      "Cardback/loose/graded status and professional grade",
      "Variant/COO stamps and weapon/accessory authenticity",
      "Seals (AFA taped/heat-sealed) and bubble clarity",
      "Provenance documentation for rare pre-production items"
    ]
  },
  {
    "category_id": "starwars",
    "subcategory_id": "starwars-vehicles",
    "subcategory_name": "Vehicles & Playsets",
    "tier_1_sources": [
      {
        "name": "Rebelscum Vehicle Archives",
        "url": "https://www.rebelscum.com/PhotoArchive.asp",
        "reason": "Model-by-model identification with detailed packaging and comprehensive part inventories.",
        "api_available": false
      },
      {
        "name": "Imperial Gunnery Database",
        "url": "https://www.imperialgunnery.com/",
        "reason": "Definitive specialist resource for vehicle and playset variations with production details.",
        "api_available": false
      }
    ],
    "tier_2_sources": [
      {
        "name": "Jedi Temple Archives",
        "url": "https://www.jeditemplearchives.com/",
        "reason": "Visual checklists and comprehensive variant notes for vehicles and playsets.",
        "api_available": false
      },
      {
        "name": "Star Wars Vehicle Archive",
        "url": "https://theswca.com/vehicles.html",
        "reason": "Detailed production timeline and part variations for authentication.",
        "api_available": false
      }
    ],
    "tier_3_sources": [
      {
        "name": "Hake's Auction Results",
        "url": "https://www.hakes.com/Auction/PastAuctions",
        "reason": "Realized prices for boxed/graded vehicles and playsets with condition documentation.",
        "api_available": false
      },
      {
        "name": "Bantha Skull Vehicle Checklist",
        "url": "https://www.banthaskull.com/",
        "reason": "Modern vehicle release tracking and variant identification.",
        "api_available": false
      }
    ],
    "key_valuation_factors": [
      "Completeness (stickers, inserts, instructions)",
      "Box condition (flaps, tray, inserts) and tape/seal authentication",
      "Variant runs and country of origin verification",
      "Professional grading status (AFA/UKG/CGC Toys)"
    ]
  },
  {
    "category_id": "starwars",
    "subcategory_id": "starwars-props",
    "subcategory_name": "Props & Ephemera",
    "tier_1_sources": [
      {
        "name": "Propstore Sold Archive",
        "url": "https://propstore.com/products/archive/",
        "reason": "World-class screen-used archive with detailed provenance documentation and benchmark sales data.",
        "api_available": false
      },
      {
        "name": "Heritage Auctions Entertainment",
        "url": "https://entertainment.ha.com/",
        "reason": "Extensive entertainment memorabilia database with frequent Star Wars consignments and realized prices.",
        "api_available": false
      }
    ],
    "tier_2_sources": [
      {
        "name": "Julien's Auctions Entertainment",
        "url": "https://www.juliensauctions.com/en/",
        "reason": "Major auction house specializing in screen-used items with recent Star Wars specialty sales.",
        "api_available": false
      },
      {
        "name": "Original Prop Blog Database",
        "url": "http://www.originalprop.com/",
        "reason": "Definitive reference for authentic prop identification with comprehensive verification guides.",
        "api_available": false
      }
    ],
    "tier_3_sources": [
      {
        "name": "The RPF Prop Identification",
        "url": "https://www.therpf.com/",
        "reason": "Expert community forum for prop authentication and identification verification.",
        "api_available": false
      },
      {
        "name": "ScreenUsed Archives",
        "url": "https://www.screenused.com/",
        "reason": "Historical sales database for entertainment props and memorabilia.",
        "api_available": false
      }
    ],
    "key_valuation_factors": [
      "Screen-matching verification and photographic documentation",
      "Production lineage (hero vs. stunt vs. background classification)",
      "Restoration history and conservation reports",
      "Cultural significance and rarity within Star Wars canon"
    ]
  },
  {
    "category_id": "art",
    "subcategory_id": "art-paintings",
    "subcategory_name": "Paintings & Prints",
    "tier_1_sources": [
      {
        "name": "Artnet Price Database",
        "url": "https://www.artnet.com/price-database/",
        "reason": "World's largest multi-house auction results database with 14+ million records and comprehensive image archives.",
        "api_available": true
      },
      {
        "name": "Benezit Dictionary of Artists",
        "url": "https://www.benezit.com/",
        "reason": "Authoritative artist biographical database with auction records, signatures, and scholarly market analysis.",
        "api_available": true
      }
    ],
    "tier_2_sources": [
      {
        "name": "Christie's Auction Results",
        "url": "https://www.christies.com/en/results",
        "reason": "Primary market leader with searchable realized prices and detailed lot documentation for fine art.",
        "api_available": false
      },
      {
        "name": "Sotheby's Results",
        "url": "https://www.sothebys.com/en/results",
        "reason": "Global auction leader with comprehensive results archives and department-specific catalogs.",
        "api_available": false
      }
    ],
    "tier_3_sources": [
      {
        "name": "MutualArt Price Database",
        "url": "https://www.mutualart.com/price-database",
        "reason": "Alternative aggregator tracking private sales and auction results with artist analytics.",
        "api_available": true
      },
      {
        "name": "askART Artist Database",
        "url": "https://www.askart.com/",
        "reason": "Comprehensive American artist database with auction results and signature verification.",
        "api_available": false
      }
    ],
    "key_valuation_factors": [
      "Artist attribution and authenticity verification (catalogue raisonné)",
      "Medium, dimensions, and period classification",
      "Provenance chain and exhibition history documentation",
      "Condition assessment and restoration reports",
      "Comparable sales at peer institutions and auction houses"
    ]
  },
  {
    "category_id": "art",
    "subcategory_id": "art-sculptures",
    "subcategory_name": "Sculptures & Decor",
    "tier_1_sources": [
      {
        "name": "Sotheby's Design/Important Design Results",
        "url": "https://www.sothebys.com/en/departments/20th-century-design",
        "reason": "Top-tier design and objects sales with record-setting results that inform high-end sculpture valuations.",
        "api_available": false
      },
      {
        "name": "Wright/Rago Design Results",
        "url": "https://www.wright20.com/",
        "reason": "Specialist auction house in modern design with comprehensive searchable results database.",
        "api_available": false
      }
    ],
    "tier_2_sources": [
      {
        "name": "ArtTactic Sculpture Index",
        "url": "https://www.arttactic.com/",
        "reason": "Specialized sculpture market analysis with edition tracking and investment analytics.",
        "api_available": true
      },
      {
        "name": "Christie's Design Results",
        "url": "https://www.christies.com/en/results",
        "reason": "Historic and contemporary design realized prices across global venues for benchmark sculptors.",
        "api_available": false
      }
    ],
    "tier_3_sources": [
      {
        "name": "Heritage Auctions Decorative Arts",
        "url": "https://www.ha.com/",
        "reason": "Major auction house with extensive decorative arts and sculpture departments.",
        "api_available": true
      },
      {
        "name": "1stDibs Market Data",
        "url": "https://www.1stdibs.com/",
        "reason": "Global marketplace for high-end sculptures with dealer pricing benchmarks.",
        "api_available": true
      }
    ],
    "key_valuation_factors": [
      "Designer attribution and edition/production documentation",
      "Materials, dimensions, and fabrication quality assessment",
      "Provenance (commissioned pieces, documented interiors)",
      "Condition and restoration history",
      "Market depth and collector demand per designer/period"
    ]
  },
  {
    "category_id": "art",
    "subcategory_id": "art-furniture",
    "subcategory_name": "Furniture",
    "tier_1_sources": [
      {
        "name": "Wright/Rago Auction Results",
        "url": "https://www.wright20.com/",
        "reason": "Leading modern/contemporary design furniture auction house with deep historical results for named designers.",
        "api_available": false
      },
      {
        "name": "Sotheby's Design",
        "url": "https://www.sothebys.com/en/departments/20th-century-design",
        "reason": "Blue-chip auction results for museum-quality furniture and design objects.",
        "api_available": false
      }
    ],
    "tier_2_sources": [
      {
        "name": "Pamono Design Archive",
        "url": "https://www.pamono.com/",
        "reason": "Specialized mid-century and designer furniture marketplace with historical sales data.",
        "api_available": true
      },
      {
        "name": "Chairish Price Guide",
        "url": "https://www.chairish.com/",
        "reason": "Vetted resale marketplace with comprehensive historical pricing for designer furniture.",
        "api_available": true
      }
    ],
    "tier_3_sources": [
      {
        "name": "1stDibs Furniture Archive",
        "url": "https://www.1stdibs.com/",
        "reason": "High-end dealer network with pricing benchmarks for luxury furniture.",
        "api_available": true
      },
      {
        "name": "LiveAuctioneers Furniture Results",
        "url": "https://www.liveauctioneers.com/",
        "reason": "Cross-platform auction comparables from multiple international houses.",
        "api_available": true
      }
    ],
    "key_valuation_factors": [
      "Designer/maker attribution and documented production",
      "Original finish vs. refinishing assessment",
      "Provenance (original commission, iconic interiors)",
      "Functional condition and structural stability",
      "Rarity and edition size documentation"
    ]
  },
  {
    "category_id": "books",
    "subcategory_id": "books-firstedition",
    "subcategory_name": "First Editions",
    "tier_1_sources": [
      {
        "name": "ABPC (American Book Prices Current)",
        "url": "https://www.abebooks.com/abpc/",
        "reason": "Authoritative auction results database for rare books with standard citation for realized prices.",
        "api_available": false
      },
      {
        "name": "Rare Book Hub (RBH)",
        "url": "https://www.rarebookhub.com/",
        "reason": "Comprehensive auction records, bibliographic references, and market analytics for books and ephemera.",
        "api_available": false
      }
    ],
    "tier_2_sources": [
      {
        "name": "ABE Books Bibliographic Database",
        "url": "https://www.abebooks.com/",
        "reason": "World's largest rare book marketplace with detailed edition identification and dealer pricing.",
        "api_available": true
      },
      {
        "name": "Heritage Auctions Rare Books",
        "url": "https://www.ha.com/",
        "reason": "Premier auction house for rare books with detailed condition reports and market-setting prices.",
        "api_available": true
      }
    ],
    "tier_3_sources": [
      {
        "name": "ESTC (English Short Title Catalogue)",
        "url": "https://estc.bl.uk/",
        "reason": "Authoritative bibliographic records for verifying issue/printing and provenance trails.",
        "api_available": false
      },
      {
        "name": "WorldCat (OCLC) API",
        "url": "https://developer.api.oclc.org/",
        "reason": "Global library holdings and publication details for edition confirmation.",
        "api_available": true
      }
    ],
    "key_valuation_factors": [
      "Edition/printing identification and points of issue verification",
      "Dust jacket presence/condition and variant analysis",
      "Author signature/association copies documentation",
      "Provenance chain and rarity assessment",
      "Market momentum from adaptations/anniversaries"
    ]
  },
  {
    "category_id": "books",
    "subcategory_id": "books-comics",
    "subcategory_name": "Comic Books",
    "tier_1_sources": [
      {
        "name": "CGC Population Report",
        "url": "https://www.cgccomics.com/population-report/",
        "reason": "Industry standard grading service with comprehensive census data for grade scarcity assessment.",
        "api_available": false
      },
      {
        "name": "GPA (GPAnalysis)",
        "url": "https://www.gpanalysis.com/",
        "reason": "Professional database of graded comic sales across major venues; industry standard for realized prices.",
        "api_available": false
      }
    ],
    "tier_2_sources": [
      {
        "name": "Heritage Auctions Comics Archive",
        "url": "https://www.ha.com/c/search-results.zx?N=55+232+1964",
        "reason": "Extensive archive of graded comic sales with detailed lot documentation and condition imagery.",
        "api_available": false
      },
      {
        "name": "GoCollect Grading Database",
        "url": "https://gocollect.com/",
        "reason": "Comprehensive sales tracking by CGC/PGX grade with census reports and market analytics.",
        "api_available": true
      }
    ],
    "tier_3_sources": [
      {
        "name": "CBCS Comics",
        "url": "https://www.cbcscomics.com/",
        "reason": "Alternative grading service with market data and population reports for cross-verification.",
        "api_available": false
      },
      {
        "name": "Overstreet Guide Online",
        "url": "https://www.overstreet.com/",
        "reason": "Traditional industry price reference guide for baseline valuations.",
        "api_available": false
      }
    ],
    "key_valuation_factors": [
      "Professional grade (CGC/CBCS/PGX) and page quality assessment",
      "Key issue status (first appearances, variants, newsstand vs. direct)",
      "Restoration disclosure (purple labels) and conservation history",
      "Census population vs. market demand analysis"
    ]
  },
  {
    "category_id": "books",
    "subcategory_id": "books-magazines",
    "subcategory_name": "Magazines & Ephemera",
    "tier_1_sources": [
      {
        "name": "CGC Population Report – Magazines",
        "url": "https://www.cgccomics.com/population-report/magazines/2/",
        "reason": "Official grade distributions for collectible magazines with rarity assessment data.",
        "api_available": false
      },
      {
        "name": "Heritage Auctions Entertainment/Historical",
        "url": "https://www.ha.com/",
        "reason": "Extensive archive of magazine and ephemera auction results with detailed condition documentation.",
        "api_available": false
      }
    ],
    "tier_2_sources": [
      {
        "name": "Hake's Auctions Prices Realized",
        "url": "https://www.hakes.com/Auction/PastAuctions",
        "reason": "Specialized pop-culture ephemera auction house with extensive historical archives.",
        "api_available": false
      },
      {
        "name": "PulpMags.org",
        "url": "http://www.pulpmags.org/",
        "reason": "Definitive reference database for pulp magazine identification and variant tracking.",
        "api_available": false
      }
    ],
    "tier_3_sources": [
      {
        "name": "Worthpoint Ephemera Database",
        "url": "https://www.worthpoint.com/",
        "reason": "Comprehensive sold magazine and paper collectibles database with pricing history.",
        "api_available": true
      },
      {
        "name": "Illustration Magazine",
        "url": "https://illustration-magazine.com/",
        "reason": "Authority on magazine cover art values and artistic significance assessment.",
        "api_available": false
      }
    ],
    "key_valuation_factors": [
      "Cover subject and cultural significance assessment",
      "Issue/variant (newsstand/subscriber) and insert completeness",
      "Professional grade scarcity (census at high grades)",
      "Provenance (signed/inscribed, celebrity ownership documentation)"
    ]
  },
  {
    "category_id": "collectibles",
    "subcategory_id": "collectibles-coins",
    "subcategory_name": "Coins & Currency",
    "tier_1_sources": [
      {
        "name": "PCGS Price Guide & Population",
        "url": "https://www.pcgs.com/priceguide",
        "reason": "Industry-leading grading service with comprehensive population reports and certification verification system.",
        "api_available": false
      },
      {
        "name": "NGC Coin Explorer & Census",
        "url": "https://www.ngccoin.com/price-guide/united-states/",
        "reason": "World's largest third-party grading service with extensive price database and population analytics.",
        "api_available": false
      }
    ],
    "tier_2_sources": [
      {
        "name": "CDN Greysheet",
        "url": "https://www.greysheet.com/",
        "reason": "Professional dealer bid/ask pricing benchmarks with enterprise data feeds available.",
        "api_available": true
      },
      {
        "name": "Heritage Auctions Coins",
        "url": "https://coins.ha.com/",
        "reason": "World's largest numismatic auction house with extensive archives and realized price database.",
        "api_available": true
      }
    ],
    "tier_3_sources": [
      {
        "name": "Numista (World Coins) API",
        "url": "https://api.numista.com",
        "reason": "Global catalog with user-vetted data and public API for identification and pricing context.",
        "api_available": true
      },
      {
        "name": "U.S. Mint Official Data",
        "url": "https://www.usmint.gov/",
        "reason": "Authoritative source for mintages, specifications, and release documentation.",
        "api_available": false
      }
    ],
    "key_valuation_factors": [
      "Professional grade and certification (PCGS/NGC) with population rarity",
      "Mintage figures and survival rate estimates",
      "Variety identification and error classification",
      "Bullion content vs. numismatic premium analysis",
      "Eye appeal factors (toning, strike quality, luster)"
    ]
  },
  {
    "category_id": "collectibles",
    "subcategory_id": "collectibles-stamps",
    "subcategory_name": "Stamps",
    "tier_1_sources": [
      {
        "name": "Scott Catalogue Online",
        "url": "https://www.amosadvantage.com/scott-catalogues",
        "reason": "Global industry standard stamp catalog with comprehensive pricing and identification system.",
        "api_available": true
      },
      {
        "name": "Siegel Auction Archives",
        "url": "https://www.siegelauctions.com/",
        "reason": "Leading specialist stamp auction house with decades of detailed results and lot documentation.",
        "api_available": true
      }
    ],
    "tier_2_sources": [
      {
        "name": "Stanley Gibbons",
        "url": "https://www.stanleygibbons.com/",
        "reason": "Authoritative UK-centric catalog and valuations system, essential for British/Commonwealth issues.",
        "api_available": false
      },
      {
        "name": "Colnect Stamp Catalog & API",
        "url": "https://colnect.com/en/help/api",
        "reason": "Large community-maintained catalog with public API for identification and basic valuation.",
        "api_available": true
      }
    ],
    "tier_3_sources": [
      {
        "name": "Philatelic Foundation Certificates",
        "url": "https://www.philatelicfoundation.org/certificates/",
        "reason": "Authentication records and expertization database for high-value stamp provenance.",
        "api_available": false
      },
      {
        "name": "StampWorld Database",
        "url": "https://www.stampworld.com/",
        "reason": "Global online stamp catalog with visual identification tools and market activity.",
        "api_available": false
      }
    ],
    "key_valuation_factors": [
      "Condition assessment (centering, gum, hinges) and professional certification",
      "Rarity factors (printings, watermarks, perforation variations)",
      "Error/variety identification and expertization documentation",
      "Market demand analysis by country/era specialization"
    ]
  },
  {
    "category_id": "collectibles",
    "subcategory_id": "collectibles-tradingcards",
    "subcategory_name": "Trading Cards",
    "tier_1_sources": [
      {
        "name": "PSA Price Guide/Population/Cert Verify",
        "url": "https://www.psacard.com/cert",
        "reason": "Industry-leading grading service with comprehensive population reports and certification verification system.",
        "api_available": false
      },
      {
        "name": "130point.com Sales",
        "url": "https://130point.com/",
        "reason": "Comprehensive eBay sales tracking including best offers for accurate market pricing data.",
        "api_available": true
      }
    ],
    "tier_2_sources": [
      {
        "name": "SGC (Certified Collectibles Group)",
        "url": "https://gosgc.com/",
        "reason": "Alternative professional grading service with population data and market coverage.",
        "api_available": false
      },
      {
        "name": "TCGplayer API (TCG segments)",
        "url": "https://docs.tcgplayer.com/docs",
        "reason": "Public API for Pokémon/MTG/TCG pricing with real-time liquidity signals.",
        "api_available": true
      }
    ],
    "tier_3_sources": [
      {
        "name": "Card Ladder",
        "url": "https://www.cardladder.com/",
        "reason": "Cross-marketplace sales aggregation and index analytics for trend analysis.",
        "api_available": false
      },
      {
        "name": "Beckett Price Guide",
        "url": "https://www.beckett.com/",
        "reason": "Long-established industry price reference with historical market data.",
        "api_available": false
      }
    ],
    "key_valuation_factors": [
      "Professional grade (PSA/SGC/BGS) and population vs. demand analysis",
      "Card variant identification (parallels, refractors, print runs)",
      "Player performance correlation and hobby cycle timing",
      "Authenticity verification of autographs/patches and pack provenance"
    ]
  },
  {
    "category_id": "sports",
    "subcategory_id": "sports-cards",
    "subcategory_name": "Trading Cards",
    "tier_1_sources": [
      {
        "name": "PSA CardFacts/Cert/Population",
        "url": "https://www.psacard.com/cert",
        "reason": "Definitive graded sports card database with comprehensive population reports and market analytics.",
        "api_available": false
      },
      {
        "name": "Heritage Auctions Sports",
        "url": "https://sports.ha.com/",
        "reason": "Extensive realized prices and detailed lot documentation for vintage/modern sports cards.",
        "api_available": false
      }
    ],
    "tier_2_sources": [
      {
        "name": "SportsCardPro Market Movers",
        "url": "https://www.sportscardpro.com/",
        "reason": "Real-time pricing trends aggregated across multiple platforms with API access.",
        "api_available": true
      },
      {
        "name": "Card Ladder Analytics",
        "url": "https://www.cardladder.com/",
        "reason": "Cross-market comparison tracking and comprehensive index analysis for sports cards.",
        "api_available": false
      }
    ],
    "tier_3_sources": [
      {
        "name": "BGS (Beckett) Grading/Verification",
        "url": "https://www.beckett-authentication.com/verify-certificate",
        "reason": "Alternative grading service with certificate verification for cross-reference validation.",
        "api_available": false
      },
      {
        "name": "HobbyDB Sports Cards",
        "url": "https://www.hobbydb.com/",
        "reason": "Comprehensive checklist database with rarity indicators and market context.",
        "api_available": false
      }
    ],
    "key_valuation_factors": [
      "Professional grade and population scarcity with eye appeal assessment",
      "Rookie card status and set/era desirability factors",
      "Parallel identification and numbering verification",
      "Market momentum correlation (season/playoffs/awards timing)"
    ]
  },
  {
    "category_id": "sports",
    "subcategory_id": "sports-jerseys",
    "subcategory_name": "Jerseys",
    "tier_1_sources": [
      {
        "name": "MeiGray Group Archive",
        "url": "https://www.meigrayauctions.com/",
        "reason": "Leading game-worn authentication specialist with comprehensive population reporting and NBA authentication databases.",
        "api_available": false
      },
      {
        "name": "Grey Flannel Auctions",
        "url": "https://bid.greyflannelauctions.com/",
        "reason": "Specialist auctioneer with photomatched jerseys and detailed provenance documentation.",
        "api_available": false
      }
    ],
    "tier_2_sources": [
      {
        "name": "Heritage Auctions Sports",
        "url": "https://sports.ha.com/",
        "reason": "Premier auction house with top-tier jersey results and marquee sales for benchmark comparables.",
        "api_available": false
      },
      {
        "name": "Legacy Collectibles",
        "url": "https://www.legacycollectibles.com/",
        "reason": "Specialized vintage jersey authentication with historical documentation expertise.",
        "api_available": true
      }
    ],
    "tier_3_sources": [
      {
        "name": "Resolution Photomatching",
        "url": "https://sportscollectorsdigest.com/collecting-101/photo-matching-authentication",
        "reason": "Independent photomatching service for validating game use and specific event dates.",
        "api_available": false
      },
      {
        "name": "SCP Auctions Past Results",
        "url": "https://scpauctions.com/",
        "reason": "Additional jersey comparables and provenance documentation examples.",
        "api_available": false
      }
    ],
    "key_valuation_factors": [
      "Photomatching capability to specific games/seasons",
      "Official team authentication programs and LOA documentation",
      "Use characteristics assessment (repairs, tagging, wear patterns)",
      "Player significance and milestone event association"
    ]
  },
  {
    "category_id": "sports",
    "subcategory_id": "sports-autographs",
    "subcategory_name": "Autographs",
    "tier_1_sources": [
      {
        "name": "PSA/DNA Certification & AutographFacts",
        "url": "https://www.psacard.com/cert",
        "reason": "Industry-leading authentication service with comprehensive population data and signature exemplar database.",
        "api_available": false
      },
      {
        "name": "JSA (James Spence Authentication)",
        "url": "https://www.spenceloa.com/verify-authenticity",
        "reason": "Premier authentication service with broad category coverage and verification database.",
        "api_available": false
      }
    ],
    "tier_2_sources": [
      {
        "name": "Beckett Authentication Services (BAS)",
        "url": "https://www.beckett-authentication.com/verify-certificate",
        "reason": "Established authentication service with certificate verification for sports/entertainment autographs.",
        "api_available": false
      },
      {
        "name": "Heritage Auctions Sports/Entertainment",
        "url": "https://sports.ha.com/",
        "reason": "Comprehensive realized prices for authenticated autographs and multi-signed collectibles.",
        "api_available": false
      }
    ],
    "tier_3_sources": [
      {
        "name": "StarStock Signature Analysis",
        "url": "https://www.starstock.com/",
        "reason": "AI-assisted signature verification technology for authentication support.",
        "api_available": false
      },
      {
        "name": "Universal Autograph Collectors Club",
        "url": "https://www.uacc.org/",
        "reason": "Reference library for signature variations and authentication standards.",
        "api_available": false
      }
    ],
    "key_valuation_factors": [
      "Third-party authentication (PSA/JSA/BAS) and LOA type verification",
      "Medium assessment (jersey, ball, photo) and signature placement/contrast",
      "Signature strength evaluation and personalization impact",
      "Player/event significance and photomatching documentation"
    ]
  }
]