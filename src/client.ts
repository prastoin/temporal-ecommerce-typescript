import { Connection, WorkflowClient } from "@temporalio/client";
import { nanoid } from "nanoid";
import {
  addToCarteSignal,
  cartWorkflow,
  removeFromCartSignal,
} from "./workflows";

async function run() {
  // Connect to the default Server location (localhost:7233)
  const connection = await Connection.connect();
  // In production, pass options to configure TLS and other settings:
  // {
  //   address: 'foo.bar.tmprl.cloud',
  //   tls: {}
  // }

  const client = new WorkflowClient({
    connection,
    // namespace: 'foo.bar', // connects to 'default' namespace if not specified
  });

  const initialProduct = {
    id: 0,
    name: "product-0",
  };
  const workflowId = "workflow-" + nanoid();
  console.log({ cartWorkflow });
  const handle = await client.start(cartWorkflow, {
    // type inference works! args: [name: string]
    args: [initialProduct],
    taskQueue: "hello-world",
    // in practice, use a meaningful business id, eg customerId or transactionId
    workflowId,
  });
  console.log(`Started workflow ${handle.workflowId}`);

  // optional: wait for client result
  setTimeout(() => handle.signal(removeFromCartSignal, initialProduct), 10000);
  setTimeout(
    () => handle.signal(addToCarteSignal, { id: 1, name: "item-1" }),
    2000
  );

  console.log(await handle.result()); // Hello, Temporal!
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
