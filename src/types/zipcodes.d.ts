declare module "zipcodes" {
  interface ZipCodeInfo {
    zip: string;
    latitude: number;
    longitude: number;
    city: string;
    state: string;
    country: string;
  }

  interface RadiusResult extends ZipCodeInfo {}

  function lookup(zip: string): ZipCodeInfo | undefined;
  function radius(zip: string, miles: number): string[];
  function distance(zipA: string, zipB: string): number | null;
  function toMiles(kilometers: number): number;
  function toKilometers(miles: number): number;
  function lookupByName(city: string, state: string): ZipCodeInfo[];
}
