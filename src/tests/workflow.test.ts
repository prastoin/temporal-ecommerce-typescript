import { TestWorkflowEnvironment } from "@temporalio/testing";
import { DefaultLogger, LogEntry, Runtime, Worker } from "@temporalio/worker";
import { nanoid } from "nanoid";
import {
  addToCartSignal,
  cartWorkflow,
  getStateQuery,
  removeFromCartSignal,
  WorkflowState,
} from "../workflows";

let testEnv: TestWorkflowEnvironment;

beforeAll(async () => {
  // Use console.log instead of console.error to avoid red output
  // Filter INFO log messages for clearer test output
  Runtime.install({
    logger: new DefaultLogger("WARN", (entry: LogEntry) =>
      console.log(`[${entry.level}]`, entry.message)
    ),
  });

  testEnv = await TestWorkflowEnvironment.createTimeSkipping();
});

afterAll(async () => {
  await testEnv?.teardown();
});

test("httpWorkflow with mock activity", async () => {
  console.log("Running httpWorkflow with mock activity");
  const { client, nativeConnection } = testEnv;
  const worker = await Worker.create({
    connection: nativeConnection,
    taskQueue: "test",
    workflowsPath: require.resolve("../workflows"),
  });

  const initialProduct = {
    id: 0,
    name: "item-0",
  };
  await worker.runUntil(async () => {
    const workflowId = nanoid();
    await client.workflow.start(cartWorkflow, {
      workflowId,
      taskQueue: "test",
      args: [initialProduct],
    });
    const handle = client.workflow.getHandle(workflowId);

    // Initial
    let state: WorkflowState = await handle.query(getStateQuery);
    const expectedWorkflowState: WorkflowState = {
      productCollection: [initialProduct],
    };
    expect(state).toStrictEqual(expectedWorkflowState);

    // Add product
    const addedProduct = { id: 1, name: "item-1" };
    await handle.signal(addToCartSignal, addedProduct);
    state = await handle.query(getStateQuery);
    expect(state).toStrictEqual({
      productCollection: [initialProduct, addedProduct],
    });

    // Double Remove
    await handle.signal(removeFromCartSignal, initialProduct);
    await handle.signal(removeFromCartSignal, addedProduct);
    state = await handle.query(getStateQuery);
    const expectedEmptyWorkflowState: WorkflowState = {
      productCollection: [],
    };
    expect(state).toStrictEqual(expectedEmptyWorkflowState);

    const result = await handle.result();
    expect(result).toBe("workflow_ended");
    return;
  });
});
