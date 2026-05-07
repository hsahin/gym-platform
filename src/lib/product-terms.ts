export const PRODUCT_TERMS = {
  member: "lid",
  members: "leden",
  membership: "lidmaatschap",
  memberships: "lidmaatschappen",
  trialClass: "proefles",
  directDebit: "incasso",
  oneTimePayment: "volledige contractbetaling",
  paymentRequest: "los betaalverzoek",
  location: "vestiging",
  locations: "vestigingen",
  creditPack: "strippenkaart",
  staffMember: "medewerker",
  staffMembers: "medewerkers",
  owner: "eigenaar",
  owners: "eigenaren",
} as const;

export type ProductTermKey = keyof typeof PRODUCT_TERMS;

export function getProductTerm(key: ProductTermKey) {
  return PRODUCT_TERMS[key];
}
