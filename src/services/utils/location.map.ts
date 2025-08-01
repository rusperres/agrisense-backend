// location.map.ts
import { DBLocation, Location } from "../../types/location";

// --- Helper function for mapping Location DTO to DBLocation entity (GeoJSON-like object) ---
export function toDBLocation(simpleLocation: Location | null): DBLocation | null {
    if (!simpleLocation || simpleLocation.lat === null || simpleLocation.lng === null) {
        return null;
    }
    return {
        type: 'Point',
        coordinates: [simpleLocation.lng, simpleLocation.lat],
        properties: {
            address: simpleLocation.address || null
        }
    };
}

// --- Helper function for mapping DBLocation entity (parsed GeoJSON object from DB) to Location DTO ---
export function fromDBLocation(dbLocation: DBLocation | null): Location | null {
    if (!dbLocation || !dbLocation.coordinates || dbLocation.coordinates.length < 2) {
        return null;
    }
    return {
        lat: dbLocation.coordinates[1], // Latitude is typically the second coordinate in GeoJSON Point
        lng: dbLocation.coordinates[0], // Longitude is typically the first coordinate in GeoJSON Point
        address: dbLocation.properties?.address || null
    };
}