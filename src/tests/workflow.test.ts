import { TestWorkflowEnvironment } from "@temporalio/testing";
import { DefaultLogger, LogEntry, Runtime, Worker } from "@temporalio/worker";
import { nanoid } from "nanoid";
import * as activities from "../activities";
import {
  abandonedCartTimeoutMs,
  addToCartSignal,
  cartWorkflow,
  getStateQuery,
  removeFromCartSignal,
  updateEmailSignal,
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

afterEach(async () => {
  jest.restoreAllMocks();
});

test("Add and remove from cart", async () => {
  const { client, nativeConnection } = testEnv;
  const worker = await Worker.create({
    connection: nativeConnection,
    taskQueue: "test",
    workflowsPath: require.resolve("../workflows"),
    activities,
  });

  const initialProduct = {
    id: 0,
    name: "item-0",
  };
  const initialWorkflowState: WorkflowState = {
    productCollection: [initialProduct],
    email: "user@domain.extension",
  };
  await worker.runUntil(async () => {
    const workflowId = nanoid();
    await client.workflow.start(cartWorkflow, {
      workflowId,
      taskQueue: "test",
      args: [initialWorkflowState],
    });
    const handle = client.workflow.getHandle(workflowId);

    // Initial
    let state: WorkflowState = await handle.query(getStateQuery);
    expect(state).toStrictEqual(initialWorkflowState);

    // Add product
    const addedProduct = { id: 1, name: "item-1" };
    await handle.signal(addToCartSignal, addedProduct);
    state = await handle.query(getStateQuery);
    expect(state).toStrictEqual({
      ...initialWorkflowState,
      productCollection: [initialProduct, addedProduct],
    });

    // Double Remove
    await handle.signal(removeFromCartSignal, initialProduct);
    await handle.signal(removeFromCartSignal, addedProduct);
    state = await handle.query(getStateQuery);
    const expectedEmptyWorkflowState: WorkflowState = {
      ...initialWorkflowState,
      productCollection: [],
    };
    expect(state).toStrictEqual(expectedEmptyWorkflowState);

    const result = await handle.result();
    expect(result).toBe("empty_cart");

    return;
  });
});

test("Abandonned cart", async () => {
  const { client, nativeConnection } = testEnv;
  const mockActivities: Partial<typeof activities> = {
    sendAbandonedCartEmail: async (email) => {
      console.log(`mock is called ${email}`);
    },
  };
  const sendAbandonedCartEmailSpy = jest.spyOn(
    mockActivities,
    "sendAbandonedCartEmail"
  );
  const worker = await Worker.create({
    connection: nativeConnection,
    taskQueue: "test",
    workflowsPath: require.resolve("../workflows"),
    activities: mockActivities,
  });

  const initialProduct = {
    id: 0,
    name: "item-0",
  };
  const initialWorkflowState: WorkflowState = {
    productCollection: [initialProduct],
    email: "user@domain.extension",
  };
  await worker.runUntil(async () => {
    const workflowId = nanoid();
    await client.workflow.start(cartWorkflow, {
      workflowId,
      taskQueue: "test",
      args: [initialWorkflowState],
    });
    const handle = client.workflow.getHandle(workflowId);

    await testEnv.sleep(abandonedCartTimeoutMs);

    const result = await handle.result();
    expect(result).toBe("abandoned_cart");
    expect(sendAbandonedCartEmailSpy).toBeCalledTimes(1);

    return;
  });
});

test("Update workflow email", async () => {
  const { client, nativeConnection } = testEnv;
  const mockActivities: Partial<typeof activities> = {
    sendAbandonedCartEmail: async (email) => {
      console.log(`mock is called ${email}`);
    },
  };
  const worker = await Worker.create({
    connection: nativeConnection,
    taskQueue: "test",
    workflowsPath: require.resolve("../workflows"),
    activities: mockActivities,
  });

  const initialWorkflowState: WorkflowState = {
    productCollection: [
      {
        id: 0,
        name: "item-0",
      },
    ],
    email: "user@domain.extension",
  };
  await worker.runUntil(async () => {
    const workflowId = nanoid();
    await client.workflow.start(cartWorkflow, {
      workflowId,
      taskQueue: "test",
      args: [initialWorkflowState],
    });
    const handle = client.workflow.getHandle(workflowId);
    const state = await handle.query(getStateQuery);
    expect(state).toStrictEqual(initialWorkflowState);

    // Send update email signal
    const newEmail = "new@email.com";
    const postUpdateEmailSignalExpectedState = {
      ...initialWorkflowState,
      email: newEmail,
    };
    await handle.signal(updateEmailSignal, newEmail);

    const postUpdateEmailSignalState = await handle.query(getStateQuery);
    expect(postUpdateEmailSignalState).toStrictEqual(
      postUpdateEmailSignalExpectedState
    );

    return;
  });
});
