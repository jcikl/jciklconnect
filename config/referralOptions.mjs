// Option lists for the member "ideal referral" fields, in plain JS so utils/idealReferrals.mjs (shared by the
// app, Netlify functions and scripts/*.mjs) can read them. config/constants.ts re-exports both.

/** Industries: the options for `industry` and `idealReferralIndustry`. Some names contain commas. */
export const INDUSTRY_OPTIONS = /** @type {const} */ ([
  'Advertising, Marketing & Media',
  'Agriculture, Forestry, Fisheries & Animals',
  'Architecture, Engineering & Construction',
  'Arts, Entertainment & Creative Design',
  'Automotive & Accessories',
  'Food & Beverages',
  'Technology, AI & Telecommunications',
  'Business & Management Consulting',
  'Education & Training',
  'Events, Exhibitions & Hospitality',
  'Banking, Finance, Investment & Insurance',
  'Healthcare & Medical Services',
  'Wellness, Fitness & Sports',
  'Legal, Accounting & Tax Services',
  'Human Resources & Recruitment',
  'Manufacturing & Industrial',
  'Wholesale, Retail & E-Commerce',
  'Beauty, Personal Care & Lifestyle',
  'Real Estate & Property Services',
  'Transportation, Logistics & Warehousing',
  'Travel & Tourism',
  'Energy, Oil & Gas & Utilities',
  'Environmental, Waste Management & Cleaning',
  'Security & Safety Services',
  'Government, NGOs & Associations',
  'Other / Unclassified'
]);

/** Ideal referral TYPES: the options for `business.idealReferrals`. */
export const IDEAL_REFERRAL_OPTIONS = /** @type {const} */ ([
  { label: 'Distributors', description: 'To help resell and distribute products in local or international markets' },
  { label: 'Resellers', description: 'To purchase and resell products/services to end users' },
  { label: 'Co-developers', description: 'For joint product or service development' },
  { label: 'Strategic Alliances', description: 'Long-term partnerships for mutual growth' },
  { label: 'Investors', description: 'For funding and scaling opportunities' },
  { label: 'Suppliers / Vendors', description: 'To source materials, components, or services' },
  { label: 'Technology Partners', description: 'For tech integration or digital transformation' },
  { label: 'Marketing / Branding Partners', description: 'To co-promote or brand products' },
  { label: 'Referral Partners / Affiliates', description: 'To refer potential customers or leads' },
  { label: 'Joint Venture Partners', description: 'For shared ownership in a new entity or project' },
  { label: 'Franchise Partners', description: 'To replicate business model in new regions' },
  { label: 'Channel Partners', description: 'To sell or promote products through different sales channels' },
  { label: 'Training / Content Partners', description: 'To create or deliver training programs or educational content' },
  { label: 'Operational Partners', description: 'To support backend operations, logistics, or HR' },
  { label: 'Government / NGO Collaborators', description: 'For public-private initiatives or CSR programs' },
  { label: 'Community / Ecosystem Partners', description: 'To build networks, events, or shared platforms' },
  { label: 'Other', description: '' }
]);
