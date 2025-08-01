// product.map.ts
import { ProductEntity } from "../../types/entities/product.entity";
import { Product } from "../../types/dtos/product.dto";
import { ProductCondition } from "../../types/enums";
import { fromDBLocation, toDBLocation } from "./location.map";
import { DBLocation } from "../../types/location";

// Define an intermediate type for the entity *after* location has been parsed
// This type represents the data exactly as mapProductEntityToProductDTO expects it.
type ProductEntityWithParsedLocation = Omit<ProductEntity, 'location'> & {
    location: DBLocation | null;
};

// Modify mapProductEntityToProductDTO to accept this new type
// Now, this function expects `entity.location` to already be a DBLocation object.
export function mapProductEntityToProductDTO(entity: ProductEntityWithParsedLocation): Product {
    return {
        id: entity.id,
        seller_id: entity.seller_id,
        name: entity.name,
        variety: entity.variety,
        quantity: entity.quantity,
        unit: entity.unit,
        price: entity.price,
        description: entity.description,
        harvest_date: new Date(entity.harvest_date),
        location: fromDBLocation(entity.location), // `entity.location` is now correctly `DBLocation | null`
        category: entity.category,
        images: entity.images,
        condition: entity.condition as ProductCondition,
        is_active: entity.is_active,
        created_at: new Date(entity.created_at),
        updated_at: new Date(entity.updated_at),
    };
}

// This function is for converting DTO to Entity-like shape for general use,
// not directly for DB inserts (which use WKT conversion).
// It's kept here if you have other uses for converting DTO to the Entity's structural representation.
export function mapProductDTOToProductEntity(dto: Product): ProductEntity {
    return {
        id: dto.id,
        seller_id: dto.seller_id,
        name: dto.name,
        variety: dto.variety,
        quantity: dto.quantity,
        unit: dto.unit,
        price: dto.price,
        description: dto.description,
        harvest_date: dto.harvest_date.toISOString(),
        location: JSON.stringify(toDBLocation(dto.location)), // Converts to GeoJSON string
        category: dto.category,
        images: dto.images,
        condition: dto.condition as ProductCondition,
        is_active: dto.is_active,
        created_at: dto.created_at.toISOString(),
        updated_at: dto.updated_at.toISOString(),
    };
}