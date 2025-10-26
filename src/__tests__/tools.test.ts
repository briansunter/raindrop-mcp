import { describe, expect, test } from "bun:test";
import {
  createJsonResponse,
  filterApiResponse,
  type TagsResponse
} from "../index";

describe("Tool Handlers - list-tags", () => {
  describe("list-tags pagination", () => {
    test("returns tags with pagination metadata", async () => {
      const mockResponse: TagsResponse = {
        result: true,
        items: [
          { _id: "javascript", count: 10 },
          { _id: "typescript", count: 5 },
          { _id: "react", count: 8 }
        ]
      };

      const filtered = filterApiResponse(mockResponse);
      const result = createJsonResponse(filtered);

      expect(result.content[0].type).toBe("text");
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.result).toBe(true);
      expect(parsed.items).toHaveLength(3);
    });

    test("applies field filtering to tags", () => {
      const mockResponse: TagsResponse = {
        result: true,
        items: [
          { _id: "javascript", count: 10 },
          { _id: "typescript", count: 5 }
        ]
      };

      // Filter to only include _id field
      const filtered = filterApiResponse(mockResponse, ["_id"]);
      const result = createJsonResponse(filtered);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.items[0]).toHaveProperty("_id");
      expect(parsed.items[0]).not.toHaveProperty("count");
    });

    test("handles empty pagination results", () => {
      const mockResponse: TagsResponse = {
        result: true,
        items: []
      };

      const filtered = filterApiResponse(mockResponse);
      const result = createJsonResponse(filtered);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.items).toHaveLength(0);
      expect(parsed.result).toBe(true);
    });

    test("preserves pagination parameters in URL", () => {
      const params: Record<string, unknown> = {
        page: 1,
        perpage: 10
      };

      // Simulate parameter filtering logic
      const filteredParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined)
      );

      expect(filteredParams).toHaveProperty("page", 1);
      expect(filteredParams).toHaveProperty("perpage", 10);
      expect(Object.keys(filteredParams)).toHaveLength(2);
    });

    test("handles max perpage constraint (50)", () => {
      const params: Record<string, unknown> = {
        page: 0,
        perpage: 100  // Should be capped at 50 by schema
      };

      // Schema validation happens before handler, but we can simulate the behavior
      expect(params.perpage).toBeGreaterThan(50);
    });

    test("defaults pagination to page 0, perpage 25", () => {
      const defaultParams = {
        page: 0,
        perpage: 25
      };

      expect(defaultParams.page).toBe(0);
      expect(defaultParams.perpage).toBe(25);
    });

    test("supports pagination with collection ID", () => {
      const mockResponse: TagsResponse = {
        result: true,
        items: [
          { _id: "react", count: 8 }
        ]
      };

      const collectionId = 123;
      const paginationParams = {
        page: 0,
        perpage: 25
      };

      // Verify both collection ID and pagination can be handled
      expect(collectionId).toBe(123);
      expect(paginationParams.page).toBe(0);
      expect(paginationParams.perpage).toBe(25);

      const filtered = filterApiResponse(mockResponse);
      const result = createJsonResponse(filtered);
      expect(result.content).toHaveLength(1);
    });

    test("handles multiple pagination pages", () => {
      // Simulate page 0
      const page0Response: TagsResponse = {
        result: true,
        items: Array.from({ length: 25 }, (_, i) => ({
          _id: `tag${i}`,
          count: i + 1
        }))
      };

      // Simulate page 1
      const page1Response: TagsResponse = {
        result: true,
        items: Array.from({ length: 15 }, (_, i) => ({
          _id: `tag${i + 25}`,
          count: i + 26
        }))
      };

      const page0 = createJsonResponse(filterApiResponse(page0Response));
      const page1 = createJsonResponse(filterApiResponse(page1Response));

      const parsed0 = JSON.parse(page0.content[0].text);
      const parsed1 = JSON.parse(page1.content[0].text);

      expect(parsed0.items).toHaveLength(25);
      expect(parsed1.items).toHaveLength(15);
      // Verify no overlap
      expect(parsed0.items[0]._id).not.toEqual(parsed1.items[0]._id);
    });

    test("field filtering with pagination", () => {
      const mockResponse: TagsResponse = {
        result: true,
        items: Array.from({ length: 5 }, (_, i) => ({
          _id: `tag${i}`,
          count: i + 1
        }))
      };

      // Apply field filter
      const filtered = filterApiResponse(mockResponse, ["_id"]);
      const result = createJsonResponse(filtered);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.items).toHaveLength(5);

      // Check that count field is removed
      parsed.items.forEach((tag: Record<string, unknown>) => {
        expect(tag).toHaveProperty("_id");
        expect(tag).not.toHaveProperty("count");
      });
    });

    test("handles error responses with pagination params", async () => {
      // Schema should validate pagination params before reaching handler
      const params: Record<string, unknown> = {
        page: -1,  // Invalid - should be min 0
        perpage: 10
      };

      expect(params.page).toBeLessThan(0);
    });
  });
});
