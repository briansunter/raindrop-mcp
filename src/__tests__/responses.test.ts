import { describe, expect, test } from "bun:test";
import {
  createSuccessResponse,
  createJsonResponse,
  createErrorResponse,
  handleMinimalResponse,
  handleMessageResponse,
  toolHandler,
} from "../index";

describe("Response Helpers", () => {
  describe("createSuccessResponse", () => {
    test("creates response with text content", () => {
      const result = createSuccessResponse("Success message");

      expect(result).toHaveProperty("content");
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({ type: "text", text: "Success message" });
    });

    test("handles empty string", () => {
      const result = createSuccessResponse("");

      expect(result.content[0].text).toBe("");
    });
  });

  describe("createJsonResponse", () => {
    test("creates response with formatted JSON", () => {
      const data = { key: "value", number: 42 };
      const result = createJsonResponse(data);

      expect(result).toHaveProperty("content");
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("key");
      expect(result.content[0].text).toContain("value");
    });

    test("formats JSON with indentation", () => {
      const data = { nested: { key: "value" } };
      const result = createJsonResponse(data);

      // Should be pretty-printed with 2 spaces
      expect(result.content[0].text).toContain("  ");
    });

    test("handles arrays", () => {
      const data = [1, 2, 3];
      const result = createJsonResponse(data);

      expect(result.content[0].text).toContain("[");
      expect(result.content[0].text).toContain("]");
    });

    test("handles null", () => {
      const result = createJsonResponse(null);

      expect(result.content[0].text).toBe("null");
    });

    test("handles boolean values", () => {
      const result = createJsonResponse(true);

      expect(result.content[0].text).toBe("true");
    });
  });

  describe("createErrorResponse", () => {
    test("creates error response from Error object", () => {
      const error = new Error("Test error");
      const result = createErrorResponse(error);

      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("isError", true);
      expect(result.content[0].text).toBe("Error: Test error");
    });

    test("creates error response from string", () => {
      const result = createErrorResponse("String error");

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error: String error");
    });

    test("creates error response from number", () => {
      const result = createErrorResponse(404);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error: 404");
    });

    test("creates error response from object", () => {
      const result = createErrorResponse({ code: 500 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error:");
    });
  });

  describe("handleMinimalResponse", () => {
    test("returns minimal response when minimal=true", () => {
      const data = { result: true, item: { id: 1 } };
      const result = handleMinimalResponse(data, true);

      expect(result.content[0].text).toBe("ok");
    });

    test("returns full JSON response when minimal=false", () => {
      const data = { result: true, item: { id: 1 } };
      const result = handleMinimalResponse(data, false);

      expect(result.content[0].text).toContain("result");
      expect(result.content[0].text).toContain("item");
    });

    test("returns full JSON response when minimal is undefined", () => {
      const data = { result: true };
      const result = handleMinimalResponse(data);

      expect(result.content[0].text).toContain("result");
    });

    test("handles arrays with minimal=false", () => {
      const data = [1, 2, 3];
      const result = handleMinimalResponse(data, false);

      expect(result.content[0].text).toContain("[");
    });
  });

  describe("handleMessageResponse", () => {
    test("returns ok when minimal=true", () => {
      const result = handleMessageResponse("Operation successful", true);

      expect(result.content[0].text).toBe("ok");
    });

    test("returns message when minimal=false", () => {
      const result = handleMessageResponse("Operation successful", false);

      expect(result.content[0].text).toBe("Operation successful");
    });

    test("returns message when minimal is undefined", () => {
      const result = handleMessageResponse("Operation successful");

      expect(result.content[0].text).toBe("Operation successful");
    });
  });

  describe("toolHandler", () => {
    test("wraps successful handler execution", async () => {
      const handler = async () => createSuccessResponse("Success");
      const wrapped = toolHandler(handler);

      const result = await wrapped({});

      expect(result.content[0].text).toBe("Success");
      expect(result).not.toHaveProperty("isError");
    });

    test("catches and wraps handler errors", async () => {
      const handler = async () => {
        throw new Error("Handler error");
      };
      const wrapped = toolHandler(handler);

      const result = await wrapped({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error: Handler error");
    });

    test("passes parameters to handler", async () => {
      const handler = async (params: { value: string }) => {
        return createSuccessResponse(params.value);
      };
      const wrapped = toolHandler(handler);

      const result = await wrapped({ value: "test" });

      expect(result.content[0].text).toBe("test");
    });

    test("handles async errors", async () => {
      const handler = async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        throw new Error("Async error");
      };
      const wrapped = toolHandler(handler);

      const result = await wrapped({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error: Async error");
    });

    test("handles thrown strings", async () => {
      const handler = async () => {
        throw "String error";
      };
      const wrapped = toolHandler(handler);

      const result = await wrapped({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error: String error");
    });

    test("preserves complex response structures", async () => {
      const complexResponse = {
        content: [{ type: "text" as const, text: "Complex" }],
        metadata: { key: "value" }
      };
      const handler = async () => complexResponse;
      const wrapped = toolHandler(handler);

      const result = await wrapped({});

      expect(result).toEqual(complexResponse);
    });
  });
});
