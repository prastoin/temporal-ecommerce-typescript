// Only import the activity types
import * as wf from "@temporalio/workflow";
// import type * as activities from "./activities";

interface Product {
  name: string;
  id: number;
}

export interface WorkflowState {
  productCollection: Product[];
}

// Signals
export const addToCartSignal = wf.defineSignal<[Product]>("addToCart");
export const removeFromCartSignal =
  wf.defineSignal<[Product]>("removeFromCart");

// Queries
export const getStateQuery = wf.defineQuery<WorkflowState>("getState");

export async function cartWorkflow(initialProduct: Product): Promise<string> {
  console.log("CREATED WORKFLOW ", { initialProduct });
  const state: WorkflowState = {
    productCollection: [initialProduct],
  };

  wf.setHandler(getStateQuery, () => {
    console.log("Received GET STATE QUERY");
    return state;
  });

  wf.setHandler(addToCartSignal, (newProduct) => {
    console.log("RECEIVED SIGNAL ADD TO CART ", { newProduct });
    state.productCollection = [...state.productCollection, newProduct];
  });

  wf.setHandler(removeFromCartSignal, (removedProduct) => {
    console.log("RECEIVED SIGNAL REMOVE FROM CART ", { removedProduct });
    state.productCollection = state.productCollection.filter(
      (product) => product.name !== removedProduct.name
    );
  });

  await wf.condition(() => state.productCollection.length === 0);

  return "workflow_ended";
}
