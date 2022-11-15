import { Connection, WorkflowClient } from "@temporalio/client";
import { nanoid } from "nanoid";
import { cartWorkflow, getStateQuery, removeFromCartSignal } from "./workflows";

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

  const state = await handle.query(getStateQuery);
  setTimeout(() => handle.signal(removeFromCartSignal, initialProduct), 6000);

  console.log({ state });
  console.log("result", await handle.result()); // Hello, Temporal!
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
