// Only import the activity types
import * as wf from "@temporalio/workflow";
import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "./activities";

export interface Product {
  name: string;
  id: string;
  quantity: number;
  price: number;
}

export interface WorkflowState {
  productCollection: Product[];
  email: string;
}

// Activities
const { sendAbandonedCartEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minute",
});

// Signals
export const checkoutCartSignal = wf.defineSignal("checkoutCart");
export const addToCartSignal = wf.defineSignal<[Product]>("addToCart");
export const updateEmailSignal = wf.defineSignal<[string]>("updateEmail");
export const removeFromCartSignal =
  wf.defineSignal<[Product]>("removeFromCart");

// Queries
export const getStateQuery = wf.defineQuery<WorkflowState>("getState");

export const abandonedCartTimeoutMs = 3000;

export async function cartWorkflow(
  initialWorkflowState: WorkflowState
): Promise<string> {
  console.log("CREATED WORKFLOW ", { initialWorkflowState });
  let abandonedCart = false;
  let checkedOut = false;
  const state: WorkflowState = initialWorkflowState;
  const cartIsEmpty = () => state.productCollection.length === 0;

  wf.setHandler(getStateQuery, () => {
    console.log("Received GET STATE QUERY");
    return state;
  });

  wf.setHandler(addToCartSignal, (newProduct) => {
    console.log("RECEIVED SIGNAL ADD TO CART ", { newProduct });

    // API should be parsing this but as it's an critical error double checking data
    const newProductQuantityIsInvalid = newProduct.quantity <= 0;
    if (newProductQuantityIsInvalid) {
      // cannot throw an error here or tests fails
      return;
    }

    const productAlreadyInCart = state.productCollection.find(
      (product) => product.id === newProduct.id
    );

    if (productAlreadyInCart) {
      state.productCollection = state.productCollection.map((product) => {
        if (product.id === newProduct.id) {
          return {
            ...product,
            quantity: product.quantity + newProduct.quantity,
          };
        }

        return product;
      });
    } else {
      state.productCollection = [...state.productCollection, newProduct];
    }
  });

  wf.setHandler(removeFromCartSignal, (removedProduct) => {
    console.log("RECEIVED SIGNAL REMOVE FROM CART ", { removedProduct });
    state.productCollection = state.productCollection
      .map((product) => {
        const isMatchingProduct = product.id === removedProduct.id;

        if (isMatchingProduct) {
          const newQuantity = product.quantity - removedProduct.quantity;
          const completlyRemoveProductFromCart = newQuantity <= 0;

          if (completlyRemoveProductFromCart) {
            return undefined;
          }

          return {
            ...product,
            quantity: newQuantity,
          };
        }

        return product;
      })
      .filter((el: Product | undefined): el is Product => el !== undefined);
  });

  wf.setHandler(updateEmailSignal, (newEmail) => {
    console.log("RECEIVED SIGNAL UDPATE EMAIL", { newEmail });
    state.email = newEmail;
  });

  wf.setHandler(checkoutCartSignal, () => {
    console.log("RECEIVED SIGNAL CHECKOUT CART");
    checkedOut = true;
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

  await wf.condition(() => cartIsEmpty() || abandonedCart || checkedOut);

  if (abandonedCart) {
    await sendAbandonedCartEmail("who@where.domain");
    return "abandoned_cart";
  }

  if (checkedOut) {
    return "checked_out_cart";
  }

  return "empty_cart";
}
