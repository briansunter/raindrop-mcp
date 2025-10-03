import { describe, expect, test } from "bun:test";
import {
  cleanTitle,
  cleanTitlesInData,
  safeJsonParse,
  resolveFieldList,
  filterObjectFields,
  filterFields,
  filterApiResponse,
  FIELD_PRESETS,
  type CollectionsResponse,
  type RaindropsResponse,
} from "../index";

describe("cleanTitle", () => {
  test("removes double quotes from start and end", () => {
    expect(cleanTitle('"Hello World"')).toBe("Hello World");
  });

  test("removes single quotes from start and end", () => {
    expect(cleanTitle("'Hello World'")).toBe("Hello World");
  });

  test("trims whitespace", () => {
    expect(cleanTitle("  Hello World  ")).toBe("Hello World");
  });

  test("handles quotes with whitespace", () => {
    expect(cleanTitle('  "Hello World"  ')).toBe("Hello World");
  });

  test("does not remove quotes if not matching", () => {
    expect(cleanTitle('"Hello World\'')).toBe('"Hello World\'');
    expect(cleanTitle('\'Hello World"')).toBe('\'Hello World"');
  });

  test("handles strings without quotes", () => {
    expect(cleanTitle("Hello World")).toBe("Hello World");
  });

  test("handles empty string", () => {
    expect(cleanTitle("")).toBe("");
  });

  test("handles strings with quotes in the middle", () => {
    expect(cleanTitle('Hello "quoted" World')).toBe('Hello "quoted" World');
  });

  test("returns non-string values unchanged", () => {
    // @ts-expect-error - testing runtime behavior with invalid types
    expect(cleanTitle(null)).toBe(null);
    // @ts-expect-error - testing runtime behavior with invalid types
    expect(cleanTitle(undefined)).toBe(undefined);
    // @ts-expect-error - testing runtime behavior with invalid types
    expect(cleanTitle(123)).toBe(123);
  });

  test("handles just quotes", () => {
    expect(cleanTitle('""')).toBe("");
    expect(cleanTitle("''")).toBe("");
  });

  test("handles nested quotes", () => {
    expect(cleanTitle('"\'nested\'"')).toBe("'nested'");
    expect(cleanTitle('\'"nested"\'')).toBe('"nested"');
  });
});

describe("cleanTitlesInData", () => {
  test("cleans title in simple object", () => {
    const data = { title: '"Test Title"', other: "value" };
    expect(cleanTitlesInData(data)).toEqual({ title: "Test Title", other: "value" });
  });

  test("cleans titles in nested objects", () => {
    const data = {
      title: '"Parent Title"',
      child: {
        title: '"Child Title"',
        value: 123
      }
    };
    expect(cleanTitlesInData(data)).toEqual({
      title: "Parent Title",
      child: {
        title: "Child Title",
        value: 123
      }
    });
  });

  test("cleans titles in arrays", () => {
    const data = [
      { title: '"Title 1"' },
      { title: '"Title 2"' }
    ];
    expect(cleanTitlesInData(data)).toEqual([
      { title: "Title 1" },
      { title: "Title 2" }
    ]);
  });

  test("handles deeply nested structures", () => {
    const data = {
      items: [
        { title: '"Item 1"', nested: { title: '"Nested 1"' } },
        { title: '"Item 2"', nested: { title: '"Nested 2"' } }
      ]
    };
    expect(cleanTitlesInData(data)).toEqual({
      items: [
        { title: "Item 1", nested: { title: "Nested 1" } },
        { title: "Item 2", nested: { title: "Nested 2" } }
      ]
    });
  });

  test("preserves non-title fields", () => {
    const data = {
      title: '"Test"',
      name: '"Not Cleaned"',
      value: 123,
      flag: true
    };
    expect(cleanTitlesInData(data)).toEqual({
      title: "Test",
      name: '"Not Cleaned"',
      value: 123,
      flag: true
    });
  });

  test("returns primitives unchanged", () => {
    expect(cleanTitlesInData("string")).toBe("string");
    expect(cleanTitlesInData(123)).toBe(123);
    expect(cleanTitlesInData(true)).toBe(true);
    expect(cleanTitlesInData(null)).toBe(null);
  });

  test("handles arrays of primitives", () => {
    expect(cleanTitlesInData([1, 2, 3])).toEqual([1, 2, 3]);
    expect(cleanTitlesInData(["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  test("handles null values in objects", () => {
    const data = { title: '"Test"', nullable: null };
    expect(cleanTitlesInData(data)).toEqual({ title: "Test", nullable: null });
  });
});

describe("safeJsonParse", () => {
  test("returns arrays unchanged", () => {
    const arr = ["a", "b", "c"];
    expect(safeJsonParse(arr)).toEqual(arr);
  });

  test("returns undefined unchanged", () => {
    expect(safeJsonParse(undefined)).toBe(undefined);
  });

  test("returns null unchanged", () => {
    expect(safeJsonParse(null)).toBe(null);
  });

  test("returns field preset strings unchanged", () => {
    expect(safeJsonParse("minimal")).toBe("minimal");
    expect(safeJsonParse("basic")).toBe("basic");
    expect(safeJsonParse("standard")).toBe("standard");
    expect(safeJsonParse("media")).toBe("media");
    expect(safeJsonParse("organization")).toBe("organization");
    expect(safeJsonParse("metadata")).toBe("metadata");
  });

  test("parses valid JSON strings", () => {
    expect(safeJsonParse('["a","b","c"]')).toEqual(["a", "b", "c"]);
    expect(safeJsonParse('{"key":"value"}')).toEqual({ key: "value" });
  });

  test("returns undefined for invalid JSON strings", () => {
    expect(safeJsonParse("not valid json")).toBe(undefined);
    expect(safeJsonParse("{invalid}")).toBe(undefined);
  });

  test("returns non-string, non-array values unchanged", () => {
    expect(safeJsonParse(123)).toBe(123);
    expect(safeJsonParse(true)).toBe(true);
    expect(safeJsonParse({ key: "value" })).toEqual({ key: "value" });
  });

  test("parses JSON with numbers", () => {
    expect(safeJsonParse("[1,2,3]")).toEqual([1, 2, 3]);
    expect(safeJsonParse('{"num":42}')).toEqual({ num: 42 });
  });

  test("parses nested JSON", () => {
    expect(safeJsonParse('{"a":{"b":"c"}}')).toEqual({ a: { b: "c" } });
  });
});

describe("resolveFieldList", () => {
  test("resolves preset to field array", () => {
    expect(resolveFieldList("minimal")).toEqual(["_id", "link", "title"]);
    expect(resolveFieldList("basic")).toEqual(["_id", "link", "title", "excerpt", "tags", "created", "domain"]);
  });

  test("resolves all presets correctly", () => {
    expect(resolveFieldList("standard")).toEqual([...FIELD_PRESETS.standard]);
    expect(resolveFieldList("media")).toEqual([...FIELD_PRESETS.media]);
    expect(resolveFieldList("organization")).toEqual([...FIELD_PRESETS.organization]);
    expect(resolveFieldList("metadata")).toEqual([...FIELD_PRESETS.metadata]);
  });

  test("returns custom array unchanged", () => {
    const custom = ["_id", "custom", "fields"];
    expect(resolveFieldList(custom)).toEqual(custom);
  });

  test("returns copy of preset array (not reference)", () => {
    const result = resolveFieldList("minimal");
    result.push("extra");
    expect(FIELD_PRESETS.minimal).toEqual(["_id", "link", "title"]);
  });

  test("handles empty custom array", () => {
    expect(resolveFieldList([])).toEqual([]);
  });
});

describe("filterObjectFields", () => {
  test("filters object to specified fields", () => {
    const obj = { _id: 1, title: "Test", extra: "removed" };
    expect(filterObjectFields(obj, ["_id", "title"])).toEqual({ _id: 1, title: "Test" });
  });

  test("handles missing fields gracefully", () => {
    const obj = { _id: 1, title: "Test" };
    expect(filterObjectFields(obj, ["_id", "title", "nonexistent"])).toEqual({ _id: 1, title: "Test" });
  });

  test("returns empty object for empty field list", () => {
    const obj = { _id: 1, title: "Test" };
    expect(filterObjectFields(obj, [])).toEqual({});
  });

  test("preserves all value types", () => {
    const obj = {
      num: 123,
      str: "text",
      bool: true,
      arr: [1, 2, 3],
      obj: { nested: "value" },
      nil: null
    };
    expect(filterObjectFields(obj, ["num", "str", "bool", "arr", "obj", "nil"])).toEqual(obj);
  });

  test("handles objects with undefined values", () => {
    const obj = { _id: 1, title: "Test", undef: undefined };
    expect(filterObjectFields(obj, ["_id", "undef"])).toEqual({ _id: 1, undef: undefined });
  });

  test("filters single field", () => {
    const obj = { _id: 1, title: "Test", extra: "removed" };
    expect(filterObjectFields(obj, ["_id"])).toEqual({ _id: 1 });
  });
});

describe("filterFields", () => {
  test("returns data unchanged if no fields specified", () => {
    const data = { _id: 1, title: "Test", extra: "value" };
    expect(filterFields(data)).toEqual(data);
  });

  test("filters single object using preset", () => {
    const data = { _id: 1, link: "url", title: "Test", extra: "removed" };
    expect(filterFields(data, "minimal")).toEqual({ _id: 1, link: "url", title: "Test" });
  });

  test("filters single object using custom array", () => {
    const data = { _id: 1, title: "Test", extra: "removed" };
    expect(filterFields(data, ["_id", "title"])).toEqual({ _id: 1, title: "Test" });
  });

  test("filters array of objects", () => {
    const data = [
      { _id: 1, title: "Test 1", extra: "removed" },
      { _id: 2, title: "Test 2", extra: "removed" }
    ];
    expect(filterFields(data, ["_id", "title"])).toEqual([
      { _id: 1, title: "Test 1" },
      { _id: 2, title: "Test 2" }
    ]);
  });

  test("returns empty objects for empty field list", () => {
    const data = [{ _id: 1, title: "Test" }];
    expect(filterFields(data, [])).toEqual([{}]);
  });

  test("handles empty array", () => {
    expect(filterFields([], ["_id"])).toEqual([]);
  });

  test("filters using different presets", () => {
    const data = {
      _id: 1,
      link: "url",
      title: "Test",
      excerpt: "excerpt",
      tags: ["tag"],
      created: "2024-01-01",
      domain: "example.com",
      extra: "removed"
    };
    const result = filterFields(data, "basic");
    expect(result).toEqual({
      _id: 1,
      link: "url",
      title: "Test",
      excerpt: "excerpt",
      tags: ["tag"],
      created: "2024-01-01",
      domain: "example.com"
    });
  });
});

describe("filterApiResponse", () => {
  test("returns data unchanged if no fields specified", () => {
    const data: CollectionsResponse = {
      result: true,
      items: [{ _id: 1, title: "Test", count: 5, public: false, view: "list" }]
    };
    expect(filterApiResponse(data)).toEqual(data);
  });

  test("filters items in CollectionsResponse", () => {
    const data: CollectionsResponse = {
      result: true,
      items: [{ _id: 1, title: "Test", count: 5, public: false, view: "list", extra: "data" } as never]
    };
    const result = filterApiResponse(data, ["_id", "title"]);
    expect(result).toEqual({
      result: true,
      items: [{ _id: 1, title: "Test" } as never]
    });
  });

  test("filters items in RaindropsResponse", () => {
    const data: RaindropsResponse = {
      result: true,
      items: [
        { _id: 1, link: "url1", title: "Test 1", extra: "removed" } as never,
        { _id: 2, link: "url2", title: "Test 2", extra: "removed" } as never
      ],
      count: 2,
      collectionId: 0
    };
    const result = filterApiResponse(data, ["_id", "title"]);
    expect(result).toEqual({
      result: true,
      items: [
        { _id: 1, title: "Test 1" } as never,
        { _id: 2, title: "Test 2" } as never
      ],
      count: 2,
      collectionId: 0
    });
  });

  test("returns only metadata for empty field list", () => {
    const data: RaindropsResponse = {
      result: true,
      items: [{ _id: 1, link: "url", title: "Test" }],
      count: 1,
      collectionId: 0
    };
    const result = filterApiResponse(data, []);
    expect(result).toEqual({
      result: true,
      count: 1,
      collectionId: 0
    });
  });

  test("filters item in single item response", () => {
    const data = {
      result: true,
      item: { _id: 1, title: "Test", extra: "removed" } as { _id: number; title: string }
    };
    const result = filterApiResponse(data, ["_id", "title"]);
    expect(result).toEqual({
      result: true,
      item: { _id: 1, title: "Test" }
    });
  });

  test("handles response without items or item", () => {
    const data = { result: true, message: "success" };
    const result = filterApiResponse(data, ["_id"]);
    expect(result).toEqual(data);
  });

  test("uses field presets", () => {
    const data: RaindropsResponse = {
      result: true,
      items: [{
        _id: 1,
        link: "url",
        title: "Test",
        excerpt: "excerpt",
        extra: "removed"
      }],
      count: 1,
      collectionId: 0
    };
    const result = filterApiResponse(data, "minimal");
    expect(result).toEqual({
      result: true,
      items: [{ _id: 1, link: "url", title: "Test" }],
      count: 1,
      collectionId: 0
    });
  });
});
