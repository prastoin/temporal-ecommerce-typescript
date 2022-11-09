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

export const abandonedCartTimeoutMs = 3000;

export async function cartWorkflow(initialProduct: Product): Promise<string> {
  console.log("CREATED WORKFLOW ", { initialProduct });
  let abandonedCart = false;
  const state: WorkflowState = {
    productCollection: [initialProduct],
  };
  const cartIsEmpty = () => state.productCollection.length === 0;

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

  wf.sleep(abandonedCartTimeoutMs)
    .then(() => {
      console.log("TIMED OUT ABANDONED CART");
      abandonedCart = true;
    })
    .catch((e) => {
      console.log("Abandoned cart timeout catch occurence");
      console.error(e);
    });

  await wf.condition(() => cartIsEmpty() || abandonedCart);

  if (abandonedCart) {
    console.log("Should be sending an email");
    // TODO send email activity
    return "abandoned_cart";
  }

  return "empty_cart";
}
