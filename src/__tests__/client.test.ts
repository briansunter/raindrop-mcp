import { describe, expect, test, beforeEach, mock } from "bun:test";
import {
  RaindropClient,
  type CollectionsResponse,
  type CollectionResponse,
  type RaindropsResponse,
  type RaindropResponse,
  type TagsResponse,
  type HighlightsResponse,
  type ParseUrlResponse,
  type CheckUrlExistsResponse,
} from "../index";

describe("RaindropClient", () => {
  let client: RaindropClient;

  beforeEach(() => {
    client = new RaindropClient("test-token");
  });

  describe("constructor", () => {
    test("initializes with correct headers", () => {
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(RaindropClient);
    });
  });

  describe("getCollections", () => {
    test("fetches root collections successfully", async () => {
      const mockResponse: CollectionsResponse = {
        result: true,
        items: [
          {
            _id: 1,
            title: "Test Collection",
            count: 5,
            public: false,
            view: "list"
          }
        ]
      };

      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const result = await client.getCollections(true);

      expect(result.result).toBe(true);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("Test Collection");
    });

    test("fetches nested collections when root=false", async () => {
      const mockResponse: CollectionsResponse = {
        result: true,
        items: []
      };

      let capturedUrl = "";
      globalThis.fetch = mock(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => mockResponse
        };
      }) as unknown as typeof fetch;

      await client.getCollections(false);

      expect(capturedUrl).toContain("/collections/childrens");
    });

    test("cleans quoted titles in response", async () => {
      const mockResponse: CollectionsResponse = {
        result: true,
        items: [
          {
            _id: 1,
            title: '"Quoted Title"',
            count: 5,
            public: false,
            view: "list"
          }
        ]
      };

      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const result = await client.getCollections(true);

      expect(result.items[0].title).toBe("Quoted Title");
    });

    test("throws error on failed request", async () => {
      const mockError = {
        result: false,
        errorMessage: "Authentication failed"
      };

      globalThis.fetch = mock(async () => ({
        ok: false,
        status: 401,
        json: async () => mockError
      })) as unknown as typeof fetch;

      expect(client.getCollections(true)).rejects.toThrow("Authentication failed");
    });
  });

  describe("getCollection", () => {
    test("fetches single collection by ID", async () => {
      const mockResponse: CollectionResponse = {
        result: true,
        item: {
          _id: 123,
          title: "My Collection",
          count: 10,
          public: true,
          view: "grid"
        }
      };

      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const result = await client.getCollection(123);

      expect(result.result).toBe(true);
      expect(result.item._id).toBe(123);
      expect(result.item.title).toBe("My Collection");
    });

    test("includes collection ID in URL", async () => {
      const mockResponse: CollectionResponse = {
        result: true,
        item: { _id: 456, title: "Test", count: 0, public: false, view: "list" }
      };

      let capturedUrl = "";
      globalThis.fetch = mock(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => mockResponse
        };
      }) as unknown as typeof fetch;

      await client.getCollection(456);

      expect(capturedUrl).toContain("/collection/456");
    });
  });

  describe("createCollection", () => {
    test("creates collection with required fields", async () => {
      const mockResponse: CollectionResponse = {
        result: true,
        item: {
          _id: 456,
          title: "New Collection",
          count: 0,
          public: false,
          view: "list"
        }
      };

      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const result = await client.createCollection({
        title: "New Collection"
      });

      expect(result.result).toBe(true);
      expect(result.item.title).toBe("New Collection");
    });

    test("sends POST request", async () => {
      const mockResponse: CollectionResponse = {
        result: true,
        item: { _id: 1, title: "Test", count: 0, public: false, view: "list" }
      };

      let capturedOptions: { method?: string } = {};
      globalThis.fetch = mock(async (_url: string, options?: { method?: string }) => {
        capturedOptions = options || {};
        return {
          ok: true,
          json: async () => mockResponse
        };
      }) as unknown as typeof fetch;

      await client.createCollection({ title: "Test" });

      expect(capturedOptions.method).toBe("POST");
    });
  });

  describe("updateCollection", () => {
    test("updates collection fields", async () => {
      const mockResponse: CollectionResponse = {
        result: true,
        item: {
          _id: 1,
          title: "Updated Title",
          count: 0,
          public: true,
          view: "list"
        }
      };

      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const result = await client.updateCollection(1, { title: "Updated Title", public: true });

      expect(result.result).toBe(true);
      expect(result.item.title).toBe("Updated Title");
      expect(result.item.public).toBe(true);
    });

    test("sends PUT request", async () => {
      const mockResponse: CollectionResponse = {
        result: true,
        item: { _id: 1, title: "Test", count: 0, public: false, view: "list" }
      };

      let capturedOptions: { method?: string } = {};
      globalThis.fetch = mock(async (_url: string, options?: { method?: string }) => {
        capturedOptions = options || {};
        return {
          ok: true,
          json: async () => mockResponse
        };
      }) as unknown as typeof fetch;

      await client.updateCollection(1, { title: "Test" });

      expect(capturedOptions.method).toBe("PUT");
    });
  });

  describe("deleteCollection", () => {
    test("deletes collection successfully", async () => {
      const mockResponse = { result: true };

      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const result = await client.deleteCollection(123);

      expect(result.result).toBe(true);
    });

    test("sends DELETE request", async () => {
      const mockResponse = { result: true };

      let capturedOptions: { method?: string } = {};
      globalThis.fetch = mock(async (_url: string, options?: { method?: string }) => {
        capturedOptions = options || {};
        return {
          ok: true,
          json: async () => mockResponse
        };
      }) as unknown as typeof fetch;

      await client.deleteCollection(123);

      expect(capturedOptions.method).toBe("DELETE");
    });
  });

  describe("getRaindrops", () => {
    test("fetches raindrops from collection", async () => {
      const mockResponse: RaindropsResponse = {
        result: true,
        items: [
          {
            _id: 1,
            link: "https://example.com",
            title: "Example"
          },
          {
            _id: 2,
            link: "https://test.com",
            title: "Test"
          }
        ],
        count: 2,
        collectionId: 0
      };

      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const result = await client.getRaindrops(0);

      expect(result.result).toBe(true);
      expect(result.items).toHaveLength(2);
      expect(result.count).toBe(2);
    });

    test("includes query parameters in request", async () => {
      const mockResponse: RaindropsResponse = {
        result: true,
        items: [],
        count: 0,
        collectionId: 0
      };

      let capturedUrl = "";
      globalThis.fetch = mock(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => mockResponse
        };
      }) as unknown as typeof fetch;

      await client.getRaindrops(0, { page: 1, perpage: 10 });

      expect(capturedUrl).toContain("page=1");
      expect(capturedUrl).toContain("perpage=10");
    });

    test("handles special collection IDs", async () => {
      const mockResponse: RaindropsResponse = {
        result: true,
        items: [],
        count: 0,
        collectionId: -1
      };

      let capturedUrl = "";
      globalThis.fetch = mock(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => mockResponse
        };
      }) as unknown as typeof fetch;

      await client.getRaindrops(-1);

      expect(capturedUrl).toContain("/raindrops/-1");
    });
  });

  describe("getRaindrop", () => {
    test("fetches single raindrop by ID", async () => {
      const mockResponse: RaindropResponse = {
        result: true,
        item: {
          _id: 123,
          link: "https://example.com",
          title: "Example"
        }
      };

      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const result = await client.getRaindrop(123);

      expect(result.result).toBe(true);
      expect(result.item._id).toBe(123);
    });
  });

  describe("createRaindrop", () => {
    test("creates raindrop with minimal data", async () => {
      const mockResponse: RaindropResponse = {
        result: true,
        item: {
          _id: 789,
          link: "https://newlink.com",
          title: "New Link"
        }
      };

      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const result = await client.createRaindrop({
        link: "https://newlink.com"
      });

      expect(result.result).toBe(true);
      expect(result.item.link).toBe("https://newlink.com");
    });

    test("creates raindrop with full data", async () => {
      const mockResponse: RaindropResponse = {
        result: true,
        item: {
          _id: 999,
          link: "https://full.com",
          title: "Full Bookmark",
          excerpt: "Description",
          tags: ["tag1", "tag2"],
          note: "My note"
        }
      };

      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const result = await client.createRaindrop({
        link: "https://full.com",
        title: "Full Bookmark",
        excerpt: "Description",
        tags: ["tag1", "tag2"],
        note: "My note"
      });

      expect(result.result).toBe(true);
      expect(result.item.tags).toEqual(["tag1", "tag2"]);
    });
  });

  describe("updateRaindrop", () => {
    test("updates raindrop fields", async () => {
      const mockResponse: RaindropResponse = {
        result: true,
        item: {
          _id: 1,
          link: "https://example.com",
          title: "Updated Title"
        }
      };

      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const result = await client.updateRaindrop(1, { title: "Updated Title" });

      expect(result.result).toBe(true);
      expect(result.item.title).toBe("Updated Title");
    });
  });

  describe("deleteRaindrop", () => {
    test("deletes raindrop successfully", async () => {
      const mockResponse = { result: true };

      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const result = await client.deleteRaindrop(123);

      expect(result.result).toBe(true);
    });
  });

  describe("searchRaindrops", () => {
    test("searches with query string", async () => {
      const mockResponse: RaindropsResponse = {
        result: true,
        items: [
          {
            _id: 1,
            link: "https://example.com",
            title: "Search Result"
          }
        ],
        count: 1,
        collectionId: 0
      };

      let capturedUrl = "";
      globalThis.fetch = mock(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => mockResponse
        };
      }) as unknown as typeof fetch;

      await client.searchRaindrops(0, "test query");

      expect(capturedUrl).toContain("search=test+query");
    });

    test("includes additional parameters", async () => {
      const mockResponse: RaindropsResponse = {
        result: true,
        items: [],
        count: 0,
        collectionId: 0
      };

      let capturedUrl = "";
      globalThis.fetch = mock(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => mockResponse
        };
      }) as unknown as typeof fetch;

      await client.searchRaindrops(0, "query", { page: 2, perpage: 25 });

      expect(capturedUrl).toContain("search=query");
      expect(capturedUrl).toContain("page=2");
      expect(capturedUrl).toContain("perpage=25");
    });
  });

  describe("getTags", () => {
    test("fetches all tags", async () => {
      const mockResponse: TagsResponse = {
        result: true,
        items: [
          { _id: "javascript", count: 10 },
          { _id: "typescript", count: 5 }
        ]
      };

      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const result = await client.getTags();

      expect(result.result).toBe(true);
      expect(result.items).toHaveLength(2);
    });

    test("fetches tags for specific collection", async () => {
      const mockResponse: TagsResponse = {
        result: true,
        items: []
      };

      let capturedUrl = "";
      globalThis.fetch = mock(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => mockResponse
        };
      }) as unknown as typeof fetch;

      await client.getTags(123);

      expect(capturedUrl).toContain("/tags/123");
    });

    test("includes pagination parameters in request", async () => {
      const mockResponse: TagsResponse = {
        result: true,
        items: [
          { _id: "javascript", count: 10 }
        ]
      };

      let capturedUrl = "";
      globalThis.fetch = mock(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => mockResponse
        };
      }) as unknown as typeof fetch;

      await client.getTags(undefined, { page: 1, perpage: 10 });

      expect(capturedUrl).toContain("page=1");
      expect(capturedUrl).toContain("perpage=10");
    });

    test("includes pagination with collection ID", async () => {
      const mockResponse: TagsResponse = {
        result: true,
        items: []
      };

      let capturedUrl = "";
      globalThis.fetch = mock(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => mockResponse
        };
      }) as unknown as typeof fetch;

      await client.getTags(456, { page: 2, perpage: 20 });

      expect(capturedUrl).toContain("/tags/456");
      expect(capturedUrl).toContain("page=2");
      expect(capturedUrl).toContain("perpage=20");
    });

    test("handles pagination for large tag sets", async () => {
      const mockResponse: TagsResponse = {
        result: true,
        items: Array.from({ length: 25 }, (_, i) => ({
          _id: `tag${i}`,
          count: i + 1
        }))
      };

      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const result = await client.getTags(undefined, { page: 0, perpage: 25 });

      expect(result.items).toHaveLength(25);
    });
  });

  describe("mergeTags", () => {
    test("merges tags successfully", async () => {
      const mockResponse = { result: true };

      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const result = await client.mergeTags(["old1", "old2"], "new");

      expect(result.result).toBe(true);
    });

    test("sends PUT request with correct body", async () => {
      const mockResponse = { result: true };

      let capturedBody = "";
      globalThis.fetch = mock(async (_url: string, options?: { body?: string }) => {
        capturedBody = options?.body || "";
        return {
          ok: true,
          json: async () => mockResponse
        };
      }) as unknown as typeof fetch;

      await client.mergeTags(["old"], "new");

      expect(capturedBody).toContain('"tags"');
      expect(capturedBody).toContain('"replace"');
    });
  });

  describe("deleteTags", () => {
    test("deletes tags successfully", async () => {
      const mockResponse = { result: true };

      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const result = await client.deleteTags(["tag1", "tag2"]);

      expect(result.result).toBe(true);
    });
  });

  describe("getHighlights", () => {
    test("fetches all highlights", async () => {
      const mockResponse: HighlightsResponse = {
        result: true,
        items: [
          { _id: "1", text: "Highlight text", note: "My note" }
        ]
      };

      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const result = await client.getHighlights();

      expect(result.result).toBe(true);
      expect(result.items).toHaveLength(1);
    });

    test("fetches highlights for specific collection", async () => {
      const mockResponse: HighlightsResponse = {
        result: true,
        items: []
      };

      let capturedUrl = "";
      globalThis.fetch = mock(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => mockResponse
        };
      }) as unknown as typeof fetch;

      await client.getHighlights(123);

      expect(capturedUrl).toContain("/highlights/123");
    });

    test("includes pagination parameters", async () => {
      const mockResponse: HighlightsResponse = {
        result: true,
        items: []
      };

      let capturedUrl = "";
      globalThis.fetch = mock(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => mockResponse
        };
      }) as unknown as typeof fetch;

      await client.getHighlights(undefined, { page: 1, perpage: 10 });

      expect(capturedUrl).toContain("page=1");
      expect(capturedUrl).toContain("perpage=10");
    });
  });

  describe("parseUrl", () => {
    test("parses URL successfully", async () => {
      const mockResponse: ParseUrlResponse = {
        result: true,
        item: {
          title: "Page Title",
          excerpt: "Page description",
          cover: "https://example.com/image.jpg"
        }
      };

      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const result = await client.parseUrl("https://example.com");

      expect(result.result).toBe(true);
      expect(result.item.title).toBe("Page Title");
    });

    test("includes URL in query parameters", async () => {
      const mockResponse: ParseUrlResponse = {
        result: true,
        item: {}
      };

      let capturedUrl = "";
      globalThis.fetch = mock(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => mockResponse
        };
      }) as unknown as typeof fetch;

      await client.parseUrl("https://test.com");

      expect(capturedUrl).toContain("url=https");
    });
  });

  describe("checkUrlExists", () => {
    test("checks URLs successfully", async () => {
      const mockResponse: CheckUrlExistsResponse = {
        result: true,
        ids: [123, 456],
        duplicates: [
          { _id: 123, link: "https://example.com" },
          { _id: 456, link: "https://test.com" }
        ]
      };

      globalThis.fetch = mock(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const result = await client.checkUrlExists(["https://example.com", "https://test.com"]);

      expect(result.result).toBe(true);
      expect(result.ids).toHaveLength(2);
      expect(result.duplicates).toHaveLength(2);
    });

    test("sends POST request with URLs", async () => {
      const mockResponse: CheckUrlExistsResponse = {
        result: true,
        ids: [],
        duplicates: []
      };

      let capturedBody = "";
      globalThis.fetch = mock(async (_url: string, options?: { body?: string }) => {
        capturedBody = options?.body || "";
        return {
          ok: true,
          json: async () => mockResponse
        };
      }) as unknown as typeof fetch;

      await client.checkUrlExists(["https://example.com"]);

      expect(capturedBody).toContain('"urls"');
    });
  });

  describe("error handling", () => {
    test("handles invalid JSON response", async () => {
      globalThis.fetch = mock(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => {
          throw new Error("Invalid JSON");
        }
      })) as unknown as typeof fetch;

      expect(client.getCollections()).rejects.toThrow("Failed to parse JSON response");
    });

    test("handles API error response", async () => {
      globalThis.fetch = mock(async () => ({
        ok: false,
        status: 404,
        json: async () => ({
          result: false,
          error: "Not found"
        })
      })) as unknown as typeof fetch;

      expect(client.getCollection(999)).rejects.toThrow("Not found");
    });

    test("handles API error with errorMessage field", async () => {
      globalThis.fetch = mock(async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          result: false,
          errorMessage: "Bad request error"
        })
      })) as unknown as typeof fetch;

      expect(client.getCollections()).rejects.toThrow("Bad request error");
    });

    test("handles network errors", async () => {
      globalThis.fetch = mock(async () => {
        throw new Error("Network error");
      }) as unknown as typeof fetch;

      expect(client.getCollections()).rejects.toThrow("Network error");
    });

    test("handles result:false without error message", async () => {
      globalThis.fetch = mock(async () => ({
        ok: false,
        status: 500,
        json: async () => ({
          result: false
        })
      })) as unknown as typeof fetch;

      expect(client.getCollections()).rejects.toThrow("API request failed: 500");
    });
  });
});
