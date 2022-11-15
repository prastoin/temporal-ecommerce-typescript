import { faker } from "@faker-js/faker";
import { Product, WorkflowState } from "../workflows";

export function getWorkflowState(): WorkflowState {
  return {
    email: faker.internet.email(),
    productCollection: [getRandomProduct()],
  };
}

/**
 *
 * @param overrides Any property you wanna override from faker default generation
 * @returns a random product with default quantity 1
 */
export function getRandomProduct(overrides?: Partial<Product>): Product {
  return {
    id: faker.datatype.uuid(),
    name: faker.commerce.product(),
    price: faker.datatype.number({
      min: 100,
      max: 200,
    }),
    quantity: 1,
    ...overrides,
  };
}
