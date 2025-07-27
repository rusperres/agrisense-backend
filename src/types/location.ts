export interface LocationResponse {
    lat: number;
    lng: number;
    address: string | null;
}

export interface DBLocation {
    type: 'Point';
    coordinates: [number, number];
    properties: {
        address: string | null;
    };
}

export interface Location {
  lat: number;
  lng: number;
  address: string | null;
}