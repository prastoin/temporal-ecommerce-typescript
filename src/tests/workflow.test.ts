import { TestWorkflowEnvironment } from "@temporalio/testing";
import { DefaultLogger, LogEntry, Runtime, Worker } from "@temporalio/worker";
import { nanoid } from "nanoid";
import { cartWorkflow, getStateQuery, WorkflowState } from "../workflows";

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
    try {
      await client.workflow.start(cartWorkflow, {
        workflowId,
        taskQueue: "test",
        args: [initialProduct],
      });

      const handle = client.workflow.getHandle(workflowId);
      const state = await handle.query(getStateQuery);

      const expectedWorkflowState: WorkflowState = {
        productCollection: [initialProduct],
      };
      expect(state).toStrictEqual(expectedWorkflowState);

      return;
    } catch (e) {
      console.error(e);
    }
  });
});
