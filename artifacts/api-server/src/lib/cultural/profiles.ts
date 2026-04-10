interface CulturalProfile {
  name: string;
  language_notes: string;
  trust_signals: string[];
  buying_triggers: string[];
  taboos: string[];
  platforms: string[];
  payment_refs: string[];
  festive_peaks: string[];
}

const profiles: Record<string, CulturalProfile> = {
  NG: {
    name: "Nigeria",
    language_notes: "Nigerian English with Pidgin markers. High energy, direct, community-focused. Lagos street culture is influential. WhatsApp is the primary business channel.",
    trust_signals: ["social proof numbers", "naija pride", "community endorsement", "verified badges"],
    buying_triggers: ["FOMO", "value for money", "community", "aspirational lifestyle"],
    taboos: ["religious insensitivity", "tribal stereotyping", "political commentary"],
    platforms: ["Instagram", "WhatsApp", "TikTok", "Twitter/X"],
    payment_refs: ["Paystack", "Flutterwave", "bank transfer", "USSD"],
    festive_peaks: ["Detty December", "Sallah", "Easter", "Independence Day Oct 1", "Children's Day May 27"],
  },
  KE: {
    name: "Kenya",
    language_notes: "Kenyan English mixed with Swahili phrases. Mobile-first, M-Pesa-centric. Community and ubuntu values. Nairobi is the innovation hub.",
    trust_signals: ["M-Pesa integration", "social proof", "community recommendations", "verified business"],
    buying_triggers: ["mobile-first convenience", "value for money", "trust", "community"],
    taboos: ["tribal references", "political statements", "disrespect of elders"],
    platforms: ["WhatsApp", "Facebook", "Twitter/X", "Instagram"],
    payment_refs: ["M-Pesa", "Airtel Money", "bank transfer"],
    festive_peaks: ["Madaraka Day Jun 1", "Jamhuri Day Dec 12", "Christmas", "Easter"],
  },
  GH: {
    name: "Ghana",
    language_notes: "Ghanaian English, warm and welcoming. Community-first. Accra is cosmopolitan. Music and fashion culture influential. 'Akwaaba' spirit of welcome.",
    trust_signals: ["social proof", "local references", "community endorsement", "Ghana pride"],
    buying_triggers: ["quality", "local pride", "community benefit", "aspiration"],
    taboos: ["disrespect of traditions", "political bias", "exclusivity"],
    platforms: ["Facebook", "WhatsApp", "Instagram", "TikTok"],
    payment_refs: ["MTN Mobile Money", "Vodafone Cash", "bank transfer"],
    festive_peaks: ["Independence Day Mar 6", "Christmas", "Homowo", "Easter"],
  },
  ZA: {
    name: "South Africa",
    language_notes: "South African English, 11 official languages. Ubuntu philosophy. Rainbow nation pride. Mix of formal and casual. Township culture influential.",
    trust_signals: ["rainbow nation values", "ubuntu", "social proof", "certified brands"],
    buying_triggers: ["value", "quality", "empowerment", "local pride", "community"],
    taboos: ["racial insensitivity", "apartheid references", "economic inequality jokes"],
    platforms: ["Facebook", "WhatsApp", "Instagram", "TikTok", "Twitter/X"],
    payment_refs: ["FNB", "Standard Bank", "SnapScan", "Zapper"],
    festive_peaks: ["Heritage Day Sep 24", "Freedom Day Apr 27", "Christmas", "Black Friday"],
  },
  EG: {
    name: "Egypt",
    language_notes: "Egyptian Arabic, formal and informal registers. Family-centric. Islamic calendar important. Cairo-centric culture. Arabic script preferred.",
    trust_signals: ["family values", "religious alignment", "quality certification", "brand heritage"],
    buying_triggers: ["family benefit", "value", "social status", "trust"],
    taboos: ["religious disrespect", "political statements", "inappropriate imagery"],
    platforms: ["Facebook", "YouTube", "Instagram", "TikTok"],
    payment_refs: ["Fawry", "Vodafone Cash", "InstaPay", "bank transfer"],
    festive_peaks: ["Ramadan", "Eid Al-Fitr", "Eid Al-Adha", "New Year", "Mother's Day Mar 21"],
  },
  SN: {
    name: "Senegal",
    language_notes: "French and Wolof. Religious and family values central. Teranga (hospitality) is core. Music (mbalax) and fashion influential.",
    trust_signals: ["community endorsement", "religious alignment", "quality", "local partnership"],
    buying_triggers: ["community", "value", "quality", "aspirational lifestyle"],
    taboos: ["disrespect of religion", "family values violations"],
    platforms: ["Facebook", "WhatsApp", "Instagram", "YouTube"],
    payment_refs: ["Orange Money", "Wave", "bank transfer"],
    festive_peaks: ["Tabaski", "Korité", "Gamou", "Independence Day Apr 4"],
  },
};

const defaultProfile: CulturalProfile = {
  name: "African Market",
  language_notes: "Pan-African English with local cultural markers. Community-focused, mobile-first, value-conscious consumers.",
  trust_signals: ["social proof", "community endorsement", "quality certification"],
  buying_triggers: ["value for money", "community", "aspirational lifestyle", "trust"],
  taboos: ["cultural insensitivity", "religious disrespect", "tribal stereotyping"],
  platforms: ["WhatsApp", "Facebook", "Instagram", "TikTok"],
  payment_refs: ["mobile money", "bank transfer", "local payment gateways"],
  festive_peaks: ["Christmas", "Easter", "Eid", "National independence days"],
};

export function getCulturalContext(country: string): CulturalProfile {
  return profiles[country.toUpperCase()] ?? defaultProfile;
}
