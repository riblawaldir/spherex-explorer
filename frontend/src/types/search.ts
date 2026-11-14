export interface SearchFilters {
  start: string;
  end: string;
  bands: string[];
  collection: string;
}

export interface Coordinates {
  ra: string;
  dec: string;
  radius: string;
}
