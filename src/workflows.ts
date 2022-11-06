// Only import the activity types
import * as wf from "@temporalio/workflow";
// import type * as activities from "./activities";

interface Product {
  name: string;
  id: number;
}

interface WorkflowState {
  productCollection: Product[];
}

export const addToCarteSignal = wf.defineSignal<[Product]>("addToCart");
export const removeFromCartSignal =
  wf.defineSignal<[Product]>("removeFromCart");

export async function cartWorkflow(initialProduct: Product): Promise<void> {
  console.log("CREATED WORKFLOW ", { initialProduct });
  const state: WorkflowState = {
    productCollection: [initialProduct],
  };

  // eslint-disable-next-line
  while (true) {
    const cartIsEmpty = state.productCollection.length === 0;

    wf.setHandler(addToCarteSignal, (newProduct) => {
      console.log("RECEIVED SIGNAL ADD TO CART ", { newProduct });
      state.productCollection = [...state.productCollection, newProduct];
    });

    wf.setHandler(removeFromCartSignal, (removedProduct) => {
      console.log("RECEIVED SIGNAL REMOVE FROM CART ", { removedProduct });
      state.productCollection = state.productCollection.filter(
        (product) => product.name !== removedProduct.name
      );
    });

    if (cartIsEmpty) {
      console.log("CART IS EMPTY KILLING THE WORKFLOW");
      break;
    }
  }
  return;
}
