#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch, { Response } from "node-fetch";

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const API_BASE_URL = "https://api.raindrop.io/rest/v1";
const AUTH_TOKEN = process.env.RAINDROP_TOKEN;

if (!AUTH_TOKEN) {
  console.error("Error: RAINDROP_TOKEN environment variable is not set");
  console.error("Please set RAINDROP_TOKEN with your Raindrop.io API token");
  process.exit(1);
}

const FIELD_PRESETS = {
  minimal: ["_id", "link", "title"],
  basic: ["_id", "link", "title", "excerpt", "tags", "created", "domain"],
  standard: ["_id", "link", "title", "excerpt", "note", "tags", "type", "cover", "created", "lastUpdate", "domain", "important"],
  media: ["_id", "link", "title", "cover", "media", "type", "file"],
  organization: ["_id", "title", "tags", "collection", "collectionId", "sort", "removed"],
  metadata: ["_id", "created", "lastUpdate", "creatorRef", "user", "broken", "cache"],
} as const;

// ============================================================================
// TYPES
// ============================================================================

type FieldPreset = keyof typeof FIELD_PRESETS;
type FieldFilter = string[] | FieldPreset;

interface RaindropApiError {
  result: false;
  error?: string;
  errorMessage?: string;
}

// ============================================================================
// TITLE CLEANING UTILITIES
// ============================================================================

function cleanTitle(title: string): string {
  if (typeof title !== "string") {return title;}

  const cleaned = title.trim();

  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    return cleaned.slice(1, -1);
  }

  return cleaned;
}

function cleanTitlesInData(data: any): any {
  if (!data || typeof data !== "object") {return data;}

  if (Array.isArray(data)) {
    return data.map(item => cleanTitlesInData(item));
  }

  const cleaned: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "title" && typeof value === "string") {
      cleaned[key] = cleanTitle(value);
    } else if (typeof value === "object" && value !== null) {
      cleaned[key] = cleanTitlesInData(value);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

// ============================================================================
// FIELD FILTERING UTILITIES
// ============================================================================

function resolveFieldList(fields: FieldFilter): string[] {
  return typeof fields === "string" && fields in FIELD_PRESETS
    ? [...FIELD_PRESETS[fields as FieldPreset]]
    : fields as string[];
}

function filterObjectFields(obj: any, fieldList: string[]): any {
  if (fieldList.length === 0) {return {};}

  const filtered: any = {};
  for (const field of fieldList) {
    if (field in obj) {
      filtered[field] = obj[field];
    }
  }
  return filtered;
}

function filterFields(data: any, fields?: FieldFilter): any {
  if (!fields) {return data;}

  const fieldList = resolveFieldList(fields);

  if (Array.isArray(data)) {
    return data.map((item: any) => filterObjectFields(item, fieldList));
  }

  return filterObjectFields(data, fieldList);
}

function filterApiResponse(data: any, fields?: FieldFilter): any {
  if (!fields) {return data;}

  const fieldList = resolveFieldList(fields);

  // For empty array, return only top-level metadata
  if (fieldList.length === 0) {
    const { item: _item, items: _items, ...metadata } = data;
    return metadata;
  }

  // Handle different response structures
  if (data.items && Array.isArray(data.items)) {
    return { ...data, items: filterFields(data.items, fields) };
  }

  if (data.item && typeof data.item === "object") {
    return { ...data, item: filterFields(data.item, fields) };
  }

  if (Array.isArray(data)) {
    return filterFields(data, fields);
  }

  return data;
}

// ============================================================================
// SCHEMA PREPROCESSING & COMMON SCHEMAS
// ============================================================================

function safeJsonParse(val: any): any {
  if (Array.isArray(val) || val === undefined || val === null) {
    return val;
  }

  if (typeof val === "string") {
    if (val in FIELD_PRESETS) {
      return val;
    }
    try {
      return JSON.parse(val);
    } catch {
      return undefined;
    }
  }

  return val;
}

// Reusable schema components
const fieldArraySchema = z.preprocess(safeJsonParse, z.array(z.string())).optional();

const fieldPresetOrArraySchema = z.preprocess(
  safeJsonParse,
  z.union([
    z.enum(["minimal", "basic", "standard", "media", "organization", "metadata"]),
    z.array(z.string())
  ])
).optional();

const tagsArraySchema = z.preprocess(safeJsonParse, z.array(z.string())).optional();

const minimalSchema = z.boolean().default(false);

const paginationSchemas = {
  page: z.number().min(0).default(0),
  perpage: z.number().min(1).max(50).default(25),
};

const sortOrderSchema = z.enum(["-created", "created", "score", "-sort", "title", "-title", "domain", "-domain"]).optional();

// ============================================================================
// RAINDROP API CLIENT
// ============================================================================

class RaindropClient {
  private headers: Record<string, string>;

  constructor(token: string) {
    this.headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  private async handleResponse(response: Response): Promise<any> {
    let data: any;
    try {
      data = await response.json() as any;
    } catch {
      throw new Error(`Failed to parse JSON response: ${response.status} ${response.statusText}`);
    }

    if (!response.ok || data.result === false) {
      const error = data as RaindropApiError;
      throw new Error(
        error.errorMessage || error.error || `API request failed: ${response.status}`
      );
    }

    return cleanTitlesInData(data);
  }

  private buildUrl(path: string, params?: Record<string, any>): string {
    const url = `${API_BASE_URL}${path}`;
    if (!params || Object.keys(params).length === 0) {return url;}

    const queryString = new URLSearchParams(params as Record<string, string>).toString();
    return `${url}?${queryString}`;
  }

  private async request(url: string, options: { method?: string; body?: string } = {}): Promise<any> {
    const response = await fetch(url, { ...options, headers: this.headers });
    return this.handleResponse(response);
  }

  // Collections API
  async getCollections(root = true): Promise<any> {
    const endpoint = root ? "/collections" : "/collections/childrens";
    return this.request(this.buildUrl(endpoint));
  }

  async getCollection(id: number): Promise<any> {
    return this.request(this.buildUrl(`/collection/${id}`));
  }

  async createCollection(data: any): Promise<any> {
    return this.request(this.buildUrl("/collection"), {
      method: "POST",
      body: JSON.stringify(data)
    });
  }

  async updateCollection(id: number, data: any): Promise<any> {
    return this.request(this.buildUrl(`/collection/${id}`), {
      method: "PUT",
      body: JSON.stringify(data)
    });
  }

  async deleteCollection(id: number): Promise<any> {
    return this.request(this.buildUrl(`/collection/${id}`), { method: "DELETE" });
  }

  // Raindrops API
  async getRaindrops(collectionId: number, params?: any): Promise<any> {
    return this.request(this.buildUrl(`/raindrops/${collectionId}`, params));
  }

  async getRaindrop(id: number): Promise<any> {
    return this.request(this.buildUrl(`/raindrop/${id}`));
  }

  async createRaindrop(data: any): Promise<any> {
    return this.request(this.buildUrl("/raindrop"), {
      method: "POST",
      body: JSON.stringify(data)
    });
  }

  async updateRaindrop(id: number, data: any): Promise<any> {
    return this.request(this.buildUrl(`/raindrop/${id}`), {
      method: "PUT",
      body: JSON.stringify(data)
    });
  }

  async deleteRaindrop(id: number): Promise<any> {
    return this.request(this.buildUrl(`/raindrop/${id}`), { method: "DELETE" });
  }

  async searchRaindrops(collectionId: number, search: string, params?: any): Promise<any> {
    return this.request(this.buildUrl(`/raindrops/${collectionId}`, { search, ...params }));
  }

  // Tags API
  async getTags(collectionId?: number): Promise<any> {
    const path = collectionId !== undefined ? `/tags/${collectionId}` : "/tags";
    return this.request(this.buildUrl(path));
  }

  async mergeTags(tags: string[], newTag: string, collectionId?: number): Promise<any> {
    const path = collectionId !== undefined ? `/tags/${collectionId}` : "/tags";
    return this.request(this.buildUrl(path), {
      method: "PUT",
      body: JSON.stringify({ tags, replace: newTag })
    });
  }

  async deleteTags(tags: string[], collectionId?: number): Promise<any> {
    const path = collectionId !== undefined ? `/tags/${collectionId}` : "/tags";
    return this.request(this.buildUrl(path), {
      method: "DELETE",
      body: JSON.stringify({ tags })
    });
  }

  // Highlights API
  async getHighlights(collectionId?: number, params?: any): Promise<any> {
    const path = collectionId !== undefined ? `/highlights/${collectionId}` : "/highlights";
    return this.request(this.buildUrl(path, params));
  }

  // Import/Export API
  async parseUrl(url: string): Promise<any> {
    return this.request(this.buildUrl("/import/url/parse", { url }));
  }

  async checkUrlExists(urls: string[]): Promise<any> {
    return this.request(this.buildUrl("/import/url/exists"), {
      method: "POST",
      body: JSON.stringify({ urls })
    });
  }
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

function createSuccessResponse(text: string) {
  return { content: [{ type: "text", text }] };
}

function createJsonResponse(data: any) {
  return createSuccessResponse(JSON.stringify(data, null, 2));
}

function createErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true
  };
}

function handleMinimalResponse(data: any, minimal?: boolean) {
  return minimal ? createSuccessResponse("ok") : createJsonResponse(data);
}

function handleMessageResponse(message: string, minimal?: boolean) {
  return createSuccessResponse(minimal ? "ok" : message);
}

// ============================================================================
// TOOL REGISTRATION WRAPPER
// ============================================================================

function toolHandler<T>(handler: (params: T) => Promise<any>) {
  return async (params: T) => {
    try {
      return await handler(params);
    } catch (error) {
      return createErrorResponse(error);
    }
  };
}

// ============================================================================
// SERVER INITIALIZATION
// ============================================================================

const server = new McpServer({
  name: "raindrop-mcp",
  version: "1.0.0",
});

const client = new RaindropClient(AUTH_TOKEN);

// ============================================================================
// COLLECTION TOOLS
// ============================================================================

server.registerTool(
  "list-collections",
  {
    title: "List Collections",
    description: "Get all root or nested collections (Note: Collections API returns all collections without pagination)",
    inputSchema: {
      root: z.boolean().default(true).describe("Get root collections (true) or nested collections (false)"),
      fields: fieldArraySchema.describe("Array of field names to include in the response (e.g., ['_id', 'title', 'count', 'public', 'parent'])")
    },
  },
  toolHandler(async ({ root, fields }: any) => {
    const result = await client.getCollections(root);
    const filtered = filterApiResponse(result, fields as FieldFilter);
    return createJsonResponse(filtered);
  })
);

server.registerTool(
  "get-collection",
  {
    title: "Get Collection",
    description: "Get details of a specific collection with field selection support",
    inputSchema: {
      id: z.number().describe("Collection ID"),
      fields: fieldArraySchema.describe("Array of field names to include in the response (e.g., ['_id', 'title', 'count', 'public', 'parent'])")
    },
  },
  toolHandler(async ({ id, fields }: any) => {
    const result = await client.getCollection(id);
    const filtered = filterApiResponse(result, fields as FieldFilter);
    return createJsonResponse(filtered);
  })
);

server.registerTool(
  "create-collection",
  {
    title: "Create Collection",
    description: "Create a new collection",
    inputSchema: {
      title: z.string().describe("Name of the collection"),
      description: z.string().optional().describe("Collection description"),
      parentId: z.number().optional().describe("Parent collection ID for nested collections"),
      view: z.enum(["list", "simple", "grid", "masonry"]).default("list").describe("View style"),
      public: z.boolean().default(false).describe("Make collection public"),
      cover: z.array(z.string()).optional().describe("Collection cover URL"),
      minimal: minimalSchema.describe("Return minimal response (just 'ok') to save space"),
    },
  },
  toolHandler(async (params: any) => {
    const data: any = {
      title: params.title,
      view: params.view,
      public: params.public,
    };

    if (params.description) {data.description = params.description;}
    if (params.parentId) {data.parent = { $id: params.parentId };}
    if (params.cover) {data.cover = params.cover;}

    const result = await client.createCollection(data);
    return handleMinimalResponse(result, params.minimal);
  })
);

server.registerTool(
  "update-collection",
  {
    title: "Update Collection",
    description: "Update an existing collection",
    inputSchema: {
      id: z.number().describe("Collection ID"),
      title: z.string().optional().describe("New name of the collection"),
      description: z.string().optional().describe("New description"),
      parentId: z.number().optional().describe("New parent collection ID"),
      view: z.enum(["list", "simple", "grid", "masonry"]).optional().describe("View style"),
      public: z.boolean().optional().describe("Make collection public/private"),
      expanded: z.boolean().optional().describe("Expand/collapse sub-collections"),
      minimal: minimalSchema.describe("Return minimal response (just 'ok') to save space"),
    },
  },
  toolHandler(async ({ id, minimal, ...fields }: any) => {
    const data: any = {};

    if (fields.title !== undefined) {data.title = fields.title;}
    if (fields.description !== undefined) {data.description = fields.description;}
    if (fields.parentId !== undefined) {data.parent = { $id: fields.parentId };}
    if (fields.view !== undefined) {data.view = fields.view;}
    if (fields.public !== undefined) {data.public = fields.public;}
    if (fields.expanded !== undefined) {data.expanded = fields.expanded;}

    const result = await client.updateCollection(id, data);
    return handleMinimalResponse(result, minimal);
  })
);

server.registerTool(
  "delete-collection",
  {
    title: "Delete Collection",
    description: "Remove a collection and all its descendants. Raindrops will be moved to Trash.",
    inputSchema: {
      id: z.number().describe("Collection ID to delete"),
      minimal: minimalSchema.describe("Return minimal response (just 'ok') to save space"),
    },
  },
  toolHandler(async ({ id, minimal }: any) => {
    await client.deleteCollection(id);
    return handleMessageResponse("Collection deleted successfully", minimal);
  })
);

// ============================================================================
// RAINDROP TOOLS
// ============================================================================

server.registerTool(
  "list-raindrops",
  {
    title: "List Raindrops",
    description: "Get raindrops from a collection with pagination and field selection support",
    inputSchema: {
      collectionId: z.number().describe("Collection ID (0 for all, -1 for Unsorted, -99 for Trash)"),
      page: paginationSchemas.page.describe("Page number (starts from 0)"),
      perpage: paginationSchemas.perpage.describe("Items per page (max 50)"),
      sort: sortOrderSchema.describe("Sort order"),
      search: z.string().optional().describe("Search query"),
      nested: z.boolean().optional().describe("Include bookmarks from nested collections"),
      fields: fieldPresetOrArraySchema.describe("Field selection: Use preset ('minimal', 'basic', 'standard', 'media', 'organization', 'metadata') or array of field names")
    },
  },
  toolHandler(async ({ collectionId, fields, ...queryParams }: any) => {
    const result = await client.getRaindrops(collectionId, queryParams);
    const filtered = filterApiResponse(result, fields as FieldFilter);
    return createJsonResponse(filtered);
  })
);

server.registerTool(
  "get-raindrop",
  {
    title: "Get Raindrop",
    description: "Get a specific raindrop/bookmark by ID with field selection support",
    inputSchema: {
      id: z.number().describe("Raindrop ID"),
      fields: fieldPresetOrArraySchema.describe("Field selection: Use preset ('minimal', 'basic', 'standard', 'media', 'organization', 'metadata') or array of field names")
    },
  },
  toolHandler(async ({ id, fields }: any) => {
    const result = await client.getRaindrop(id);
    const filtered = filterApiResponse(result, fields as FieldFilter);
    return createJsonResponse(filtered);
  })
);

server.registerTool(
  "create-raindrop",
  {
    title: "Create Raindrop",
    description: "Create a new raindrop/bookmark",
    inputSchema: {
      link: z.string().describe("URL of the bookmark"),
      title: z.string().optional().describe("Title (will be auto-parsed if not provided)"),
      excerpt: z.string().optional().describe("Description/excerpt"),
      note: z.string().optional().describe("Personal note"),
      tags: tagsArraySchema.describe("Tags for the bookmark"),
      collectionId: z.number().optional().describe("Collection ID (default: -1 for Unsorted)"),
      important: z.boolean().optional().describe("Mark as favorite"),
      pleaseParse: z.boolean().default(true).describe("Auto-parse metadata from URL"),
      minimal: minimalSchema.describe("Return minimal response (just 'ok') to save space"),
    },
  },
  toolHandler(async (params: any) => {
    const data: any = { link: params.link };

    if (params.title) {data.title = params.title;}
    if (params.excerpt) {data.excerpt = params.excerpt;}
    if (params.note) {data.note = params.note;}
    if (params.tags) {data.tags = params.tags;}
    if (params.collectionId !== undefined) {data.collection = { $id: params.collectionId };}
    if (params.important !== undefined) {data.important = params.important;}
    if (params.pleaseParse) {data.pleaseParse = {};}

    const result = await client.createRaindrop(data);
    return handleMinimalResponse(result, params.minimal);
  })
);

server.registerTool(
  "update-raindrop",
  {
    title: "Update Raindrop",
    description: "Update an existing raindrop/bookmark with field selection support",
    inputSchema: {
      id: z.number().describe("Raindrop ID"),
      title: z.string().optional().describe("New title"),
      excerpt: z.string().optional().describe("New description"),
      note: z.string().optional().describe("New note"),
      tags: tagsArraySchema.describe("New tags (replaces existing)"),
      link: z.string().optional().describe("New URL"),
      collectionId: z.number().optional().describe("Move to different collection"),
      important: z.boolean().optional().describe("Mark/unmark as favorite"),
      order: z.number().optional().describe("Sort order position"),
      fields: fieldPresetOrArraySchema.describe("Field selection: Use preset ('minimal', 'basic', 'standard', 'media', 'organization', 'metadata'), array of field names, or empty array [] to return only result status"),
      minimal: minimalSchema.describe("Return minimal response (just 'ok') to save space"),
    },
  },
  toolHandler(async ({ id, collectionId, fields, minimal, ...updates }: any) => {
    const data: any = { ...updates };

    if (collectionId !== undefined) {
      data.collection = { $id: collectionId };
    }

    const result = await client.updateRaindrop(id, data);

    if (minimal) {
      return createSuccessResponse("ok");
    }

    const filtered = filterApiResponse(result, fields as FieldFilter);
    return createJsonResponse(filtered);
  })
);

server.registerTool(
  "delete-raindrop",
  {
    title: "Delete Raindrop",
    description: "Delete a raindrop/bookmark (moves to Trash, or permanently deletes if already in Trash)",
    inputSchema: {
      id: z.number().describe("Raindrop ID to delete"),
      minimal: minimalSchema.describe("Return minimal response (just 'ok') to save space"),
    },
  },
  toolHandler(async ({ id, minimal }: any) => {
    await client.deleteRaindrop(id);
    return handleMessageResponse("Raindrop deleted successfully", minimal);
  })
);

server.registerTool(
  "search-raindrops",
  {
    title: "Search Raindrops",
    description: "Search for raindrops using Raindrop.io's search syntax with pagination and field selection support",
    inputSchema: {
      search: z.string().describe("Search query (supports operators like #tag, site:example.com, etc.)"),
      collectionId: z.number().default(0).describe("Collection to search in (0 for all)"),
      page: paginationSchemas.page.describe("Page number (starts from 0)"),
      perpage: paginationSchemas.perpage.describe("Items per page (max 50)"),
      sort: sortOrderSchema.describe("Sort order"),
      fields: fieldPresetOrArraySchema.describe("Field selection: Use preset ('minimal', 'basic', 'standard', 'media', 'organization', 'metadata') or array of field names")
    },
  },
  toolHandler(async ({ collectionId, search, fields, ...otherParams }: any) => {
    const result = await client.searchRaindrops(collectionId, search, otherParams);
    const filtered = filterApiResponse(result, fields as FieldFilter);
    return createJsonResponse(filtered);
  })
);

// ============================================================================
// TAG TOOLS
// ============================================================================

server.registerTool(
  "list-tags",
  {
    title: "List Tags",
    description: "Get all tags or tags from a specific collection (Note: Tags API returns all tags without pagination)",
    inputSchema: {
      collectionId: z.number().optional().describe("Collection ID (omit for all tags)"),
      fields: fieldArraySchema.describe("Array of field names to include in the response (e.g., ['_id', 'count'])")
    },
  },
  toolHandler(async ({ collectionId, fields }: any) => {
    const result = await client.getTags(collectionId);
    const filtered = filterApiResponse(result, fields as FieldFilter);
    return createJsonResponse(filtered);
  })
);

server.registerTool(
  "merge-tags",
  {
    title: "Merge/Rename Tags",
    description: "Merge multiple tags into a new tag name, or rename a single tag. All specified tags will be replaced with the new tag name across all bookmarks.",
    inputSchema: {
      tags: z.preprocess(
        safeJsonParse,
        z.array(z.string()).min(1, "At least one tag must be specified")
      ).describe("List of tag names to merge/rename (can be a single tag or multiple tags)"),
      newTag: z.string().min(1, "New tag name is required and cannot be empty").describe("New tag name to replace all specified tags"),
      collectionId: z.number().optional().describe("Limit operation to specific collection (omit to apply across all collections)"),
      minimal: minimalSchema.describe("Return minimal response (just 'ok') to save space, instead of detailed success message"),
    },
  },
  toolHandler(async ({ tags, newTag, collectionId, minimal }: any) => {
    if (!tags || tags.length === 0) {
      throw new Error("Parameter 'tags' is required and must be a non-empty array of tag names");
    }
    if (!newTag || newTag.trim() === "") {
      throw new Error("Parameter 'newTag' is required and cannot be empty");
    }

    await client.mergeTags(tags, newTag, collectionId);

    if (minimal) {
      return createSuccessResponse("ok");
    }

    const message = tags.length === 1
      ? "Tag renamed successfully"
      : `${tags.length} tags merged into '${newTag}' successfully`;

    return createSuccessResponse(message);
  })
);

server.registerTool(
  "delete-tags",
  {
    title: "Delete Tags",
    description: "Delete one or more tags",
    inputSchema: {
      tags: z.array(z.string()).describe("Tags to delete"),
      collectionId: z.number().optional().describe("Limit to specific collection"),
      minimal: minimalSchema.describe("Return minimal response (just 'ok') to save space"),
    },
  },
  toolHandler(async ({ tags, collectionId, minimal }: any) => {
    await client.deleteTags(tags, collectionId);
    return handleMessageResponse("Tags deleted successfully", minimal);
  })
);

// ============================================================================
// HIGHLIGHT TOOLS
// ============================================================================

server.registerTool(
  "list-highlights",
  {
    title: "List Highlights",
    description: "Get all highlights or highlights from a specific collection with pagination and field selection support",
    inputSchema: {
      collectionId: z.number().optional().describe("Collection ID (omit for all highlights)"),
      page: paginationSchemas.page.describe("Page number (starts from 0)"),
      perpage: paginationSchemas.perpage.describe("Items per page (max 50, default 25)"),
      fields: fieldArraySchema.describe("Array of field names to include in the response (e.g., ['_id', 'text', 'color', 'note', 'created'])")
    },
  },
  toolHandler(async ({ collectionId, fields, ...queryParams }: any) => {
    const result = await client.getHighlights(collectionId, queryParams);
    const filtered = filterApiResponse(result, fields as FieldFilter);
    return createJsonResponse(filtered);
  })
);

// ============================================================================
// URL PARSING TOOLS
// ============================================================================

server.registerTool(
  "parse-url",
  {
    title: "Parse URL",
    description: "Parse and extract metadata from a URL",
    inputSchema: {
      url: z.string().describe("URL to parse"),
    },
  },
  toolHandler(async ({ url }: any) => {
    const result = await client.parseUrl(url);
    return createJsonResponse(result);
  })
);

server.registerTool(
  "check-url-exists",
  {
    title: "Check URL Exists",
    description: "Check if URLs are already saved in your Raindrop.io account",
    inputSchema: {
      urls: z.array(z.string()).describe("URLs to check"),
    },
  },
  toolHandler(async ({ urls }: any) => {
    const result = await client.checkUrlExists(urls);
    return createJsonResponse(result);
  })
);

// ============================================================================
// SERVER STARTUP
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Raindrop.io MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
