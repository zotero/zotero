export interface ItemPrice {
  id: string;
  name: string;
  description?: string;
  currencyCode: string;
  priceId: string;
  period: number;
  periodUnit: string;
  price: number;
  yearlyPrice?: number;
}
