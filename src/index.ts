#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch, { type Response } from "node-fetch";

// Debug logging helper - writes to stderr
const debugLog = (...args: unknown[]) => {
  console.error("[raindrop-mcp]", ...args);
};

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

debugLog("Starting Raindrop MCP server...");
debugLog("Node version:", process.version);
debugLog("Current directory:", process.cwd());

const API_BASE_URL = "https://api.raindrop.io/rest/v1";
const AUTH_TOKEN = process.env.RAINDROP_TOKEN;

debugLog("Checking for RAINDROP_TOKEN...");
debugLog("RAINDROP_TOKEN present:", !!AUTH_TOKEN);
debugLog("RAINDROP_TOKEN length:", AUTH_TOKEN?.length || 0);

if (!AUTH_TOKEN) {
  console.error("Error: RAINDROP_TOKEN environment variable is not set");
  console.error("Please set RAINDROP_TOKEN with your Raindrop.io API token");
  console.error("Available env vars:", Object.keys(process.env).filter(k => k.includes("RAINDROP") || k.includes("TOKEN")).join(", "));
  console.error("All env var keys:", Object.keys(process.env).sort().join(", "));
  process.exit(1);
}

debugLog("RAINDROP_TOKEN found, continuing initialization...");

const FIELD_PRESETS = {
  minimal: ["_id", "link", "title"],
  basic: ["_id", "link", "title", "excerpt", "tags", "created", "domain"],
  standard: ["_id", "link", "title", "excerpt", "note", "tags", "type", "cover", "created", "lastUpdate", "domain", "important"],
  media: ["_id", "link", "title", "cover", "media", "type", "file"],
  organization: ["_id", "title", "tags", "collection", "collectionId", "sort", "removed"],
  metadata: ["_id", "created", "lastUpdate", "creatorRef", "user", "broken", "cache"],
} as const;

// ============================================================================
// TYPES - API Entities
// ============================================================================

type FieldPreset = keyof typeof FIELD_PRESETS;
type FieldFilter = string[] | FieldPreset;

interface RaindropApiError {
  result: false;
  error?: string;
  errorMessage?: string;
}

interface Collection {
  _id: number;
  title: string;
  description?: string;
  count: number;
  public: boolean;
  view: "list" | "simple" | "grid" | "masonry";
  cover?: string[];
  parent?: { $id: number; $ref?: string };
  expanded?: boolean;
  sort?: number;
  creatorRef?: number;
  created?: string;
  lastUpdate?: string;
  user?: { $id: number };
  [key: string]: unknown;
}

interface Raindrop {
  _id: number;
  link: string;
  title: string;
  excerpt?: string;
  note?: string;
  tags?: string[];
  type?: string;
  cover?: string;
  media?: Array<{ link: string; type: string }>;
  file?: { name: string; size: number; type: string };
  created?: string;
  lastUpdate?: string;
  domain?: string;
  important?: boolean;
  removed?: boolean;
  collection?: { $id: number; $ref?: string; oid?: number };
  collectionId?: number;
  sort?: number;
  creatorRef?: number;
  user?: { $id: number };
  broken?: boolean;
  cache?: { status: string; size: number; created: string };
  [key: string]: unknown;
}

interface Tag {
  _id: string;
  count: number;
}

interface Highlight {
  _id: string;
  text: string;
  note?: string;
  color?: string;
  created?: string;
  lastUpdate?: string;
  raindropRef?: number;
  [key: string]: unknown;
}

// Response wrapper types
interface CollectionsResponse {
  result: boolean;
  items: Collection[];
}

interface CollectionResponse {
  result: boolean;
  item: Collection;
}

interface RaindropsResponse {
  result: boolean;
  items: Raindrop[];
  count: number;
  collectionId: number;
}

interface RaindropResponse {
  result: boolean;
  item: Raindrop;
}

interface TagsResponse {
  result: boolean;
  items: Tag[];
}

interface HighlightsResponse {
  result: boolean;
  items: Highlight[];
}

interface ParseUrlResponse {
  result: boolean;
  item: {
    title?: string;
    excerpt?: string;
    cover?: string;
    type?: string;
  };
}

interface CheckUrlExistsResponse {
  result: boolean;
  ids: number[];
  duplicates: Array<{ _id: number; link: string }>;
}

type ApiResponse =
  | CollectionsResponse
  | CollectionResponse
  | RaindropsResponse
  | RaindropResponse
  | TagsResponse
  | HighlightsResponse
  | ParseUrlResponse
  | CheckUrlExistsResponse
  | { result: boolean; [key: string]: unknown };

// ============================================================================
// TYPES - Utility
// ============================================================================

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
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

function cleanTitlesInData<T>(data: T): T {
  if (!data || typeof data !== "object") {return data;}

  if (Array.isArray(data)) {
    return data.map(item => cleanTitlesInData(item)) as T;
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (key === "title" && typeof value === "string") {
      cleaned[key] = cleanTitle(value);
    } else if (typeof value === "object" && value !== null) {
      cleaned[key] = cleanTitlesInData(value);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned as T;
}

// ============================================================================
// FIELD FILTERING UTILITIES
// ============================================================================

function resolveFieldList(fields: FieldFilter): string[] {
  return typeof fields === "string" && fields in FIELD_PRESETS
    ? [...FIELD_PRESETS[fields as FieldPreset]]
    : fields as string[];
}

function filterObjectFields<T extends Record<string, unknown>>(
  obj: T,
  fieldList: string[]
): Partial<T> {
  if (fieldList.length === 0) {return {} as Partial<T>;}

  const filtered: Partial<T> = {};
  for (const field of fieldList) {
    if (field in obj) {
      filtered[field as keyof T] = obj[field as keyof T];
    }
  }
  return filtered;
}

function filterFields<T extends Record<string, unknown>>(
  data: T | T[],
  fields?: FieldFilter
): T | T[] | Partial<T> | Partial<T>[] {
  if (!fields) {return data;}

  const fieldList = resolveFieldList(fields);

  if (Array.isArray(data)) {
    return data.map((item) => filterObjectFields(item, fieldList));
  }

  return filterObjectFields(data, fieldList);
}

function filterApiResponse<T extends ApiResponse>(
  data: T,
  fields?: FieldFilter
): T | Partial<T> {
  if (!fields) {return data;}

  const fieldList = resolveFieldList(fields);

  // For empty array, return only top-level metadata
  if (fieldList.length === 0) {
    const { item: _item, items: _items, ...metadata } = data as Record<string, unknown>;
    return metadata as Partial<T>;
  }

  // Handle different response structures
  if ("items" in data && Array.isArray(data.items)) {
    return { ...data, items: filterFields(data.items as Record<string, unknown>[], fields) } as T;
  }

  if ("item" in data && typeof data.item === "object" && data.item !== null) {
    return { ...data, item: filterFields(data.item as Record<string, unknown>, fields) } as T;
  }

  return data;
}

// ============================================================================
// SCHEMA PREPROCESSING & COMMON SCHEMAS
// ============================================================================

function safeJsonParse(val: unknown): unknown {
  if (Array.isArray(val) || val === undefined || val === null) {
    return val;
  }

  if (typeof val === "string") {
    if (val in FIELD_PRESETS) {
      return val;
    }
    try {
      return JSON.parse(val) as unknown;
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

// Input schemas for tools
const listCollectionsSchema = {
  root: z.boolean().default(true).describe("Get root collections (true) or nested collections (false)"),
  fields: fieldArraySchema.describe("Array of field names to include in the response (e.g., ['_id', 'title', 'count', 'public', 'parent'])")
};

const getCollectionSchema = {
  id: z.number().describe("Collection ID"),
  fields: fieldArraySchema.describe("Array of field names to include in the response (e.g., ['_id', 'title', 'count', 'public', 'parent'])")
};

const createCollectionSchema = {
  title: z.string().describe("Name of the collection"),
  description: z.string().optional().describe("Collection description"),
  parentId: z.number().optional().describe("Parent collection ID for nested collections"),
  view: z.enum(["list", "simple", "grid", "masonry"]).default("list").describe("View style"),
  public: z.boolean().default(false).describe("Make collection public"),
  cover: z.array(z.string()).optional().describe("Collection cover URL"),
  minimal: minimalSchema.describe("Return minimal response (just 'ok') to save space"),
};

const updateCollectionSchema = {
  id: z.number().describe("Collection ID"),
  title: z.string().optional().describe("New name of the collection"),
  description: z.string().optional().describe("New description"),
  parentId: z.number().optional().describe("New parent collection ID"),
  view: z.enum(["list", "simple", "grid", "masonry"]).optional().describe("View style"),
  public: z.boolean().optional().describe("Make collection public/private"),
  expanded: z.boolean().optional().describe("Expand/collapse sub-collections"),
  minimal: minimalSchema.describe("Return minimal response (just 'ok') to save space"),
};

const deleteCollectionSchema = {
  id: z.number().describe("Collection ID to delete"),
  minimal: minimalSchema.describe("Return minimal response (just 'ok') to save space"),
};

const listRaindropsSchema = {
  collectionId: z.number().describe("Collection ID (0 for all, -1 for Unsorted, -99 for Trash)"),
  page: paginationSchemas.page.describe("Page number (starts from 0)"),
  perpage: paginationSchemas.perpage.describe("Items per page (max 50)"),
  sort: sortOrderSchema.describe("Sort order"),
  search: z.string().optional().describe("Search query"),
  nested: z.boolean().optional().describe("Include bookmarks from nested collections"),
  fields: fieldPresetOrArraySchema.describe("Field selection: Use preset ('minimal', 'basic', 'standard', 'media', 'organization', 'metadata') or array of field names")
};

const getRaindropSchema = {
  id: z.number().describe("Raindrop ID"),
  fields: fieldPresetOrArraySchema.describe("Field selection: Use preset ('minimal', 'basic', 'standard', 'media', 'organization', 'metadata') or array of field names")
};

const createRaindropSchema = {
  link: z.string().describe("URL of the bookmark"),
  title: z.string().optional().describe("Title (will be auto-parsed if not provided)"),
  excerpt: z.string().optional().describe("Description/excerpt"),
  note: z.string().optional().describe("Personal note"),
  tags: tagsArraySchema.describe("Tags for the bookmark"),
  collectionId: z.number().optional().describe("Collection ID (default: -1 for Unsorted)"),
  important: z.boolean().optional().describe("Mark as favorite"),
  pleaseParse: z.boolean().default(true).describe("Auto-parse metadata from URL"),
  minimal: minimalSchema.describe("Return minimal response (just 'ok') to save space"),
};

const updateRaindropSchema = {
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
};

const deleteRaindropSchema = {
  id: z.number().describe("Raindrop ID to delete"),
  minimal: minimalSchema.describe("Return minimal response (just 'ok') to save space"),
};

const createRaindropsBulkSchema = {
  raindrops: z.array(z.object({
    link: z.string().describe("URL of the bookmark"),
    title: z.string().optional().describe("Title (will be auto-parsed if not provided)"),
    excerpt: z.string().optional().describe("Description/excerpt"),
    note: z.string().optional().describe("Personal note"),
    tags: tagsArraySchema.describe("Tags for the bookmark"),
    collectionId: z.number().optional().describe("Collection ID (default: -1 for Unsorted)"),
    important: z.boolean().optional().describe("Mark as favorite"),
    pleaseParse: z.boolean().default(true).describe("Auto-parse metadata from URL"),
  })).min(1, "At least one raindrop must be provided").max(50, "Maximum 50 raindrops can be created at once").describe("Array of raindrops to create"),
  delayMs: z.number().min(100).max(5000).default(500).describe("Delay between requests in milliseconds to avoid rate limiting"),
  continueOnError: z.boolean().default(false).describe("Continue processing remaining raindrops if one fails"),
  minimal: minimalSchema.describe("Return minimal response (just summary) to save space"),
};

const searchRaindropsSchema = {
  search: z.string().describe("Search query (supports operators like #tag, site:example.com, etc.)"),
  collectionId: z.number().default(0).describe("Collection to search in (0 for all)"),
  page: paginationSchemas.page.describe("Page number (starts from 0)"),
  perpage: paginationSchemas.perpage.describe("Items per page (max 50)"),
  sort: sortOrderSchema.describe("Sort order"),
  fields: fieldPresetOrArraySchema.describe("Field selection: Use preset ('minimal', 'basic', 'standard', 'media', 'organization', 'metadata') or array of field names")
};

const listTagsSchema = {
  collectionId: z.number().optional().describe("Collection ID (omit for all tags)"),
  page: paginationSchemas.page.describe("Page number (starts from 0)"),
  perpage: paginationSchemas.perpage.describe("Items per page (max 50, default 25)"),
  fields: fieldArraySchema.describe("Array of field names to include in the response (e.g., ['_id', 'count'])")
};

const mergeTagsSchema = {
  tags: z.preprocess(
    safeJsonParse,
    z.array(z.string()).min(1, "At least one tag must be specified")
  ).describe("List of tag names to merge/rename (can be a single tag or multiple tags)"),
  newTag: z.string().min(1, "New tag name is required and cannot be empty").describe("New tag name to replace all specified tags"),
  collectionId: z.number().optional().describe("Limit operation to specific collection (omit to apply across all collections)"),
  minimal: minimalSchema.describe("Return minimal response (just 'ok') to save space, instead of detailed success message"),
};

const deleteTagsSchema = {
  tags: z.array(z.string()).describe("Tags to delete"),
  collectionId: z.number().optional().describe("Limit to specific collection"),
  minimal: minimalSchema.describe("Return minimal response (just 'ok') to save space"),
};

const listHighlightsSchema = {
  collectionId: z.number().optional().describe("Collection ID (omit for all highlights)"),
  page: paginationSchemas.page.describe("Page number (starts from 0)"),
  perpage: paginationSchemas.perpage.describe("Items per page (max 50, default 25)"),
  fields: fieldArraySchema.describe("Array of field names to include in the response (e.g., ['_id', 'text', 'color', 'note', 'created'])")
};

const parseUrlSchema = {
  url: z.string().describe("URL to parse"),
};

const checkUrlExistsSchema = {
  urls: z.array(z.string()).describe("URLs to check"),
};

// Parameter types for tool handlers
interface ListCollectionsParams {
  root: boolean;
  fields?: string[];
}

interface GetCollectionParams {
  id: number;
  fields?: string[];
}

interface CreateCollectionParams {
  title: string;
  description?: string;
  parentId?: number;
  view: "list" | "simple" | "grid" | "masonry";
  public: boolean;
  cover?: string[];
  minimal: boolean;
}

interface UpdateCollectionParams {
  id: number;
  title?: string;
  description?: string;
  parentId?: number;
  view?: "list" | "simple" | "grid" | "masonry";
  public?: boolean;
  expanded?: boolean;
  minimal: boolean;
}

interface DeleteCollectionParams {
  id: number;
  minimal: boolean;
}

interface ListRaindropsParams {
  collectionId: number;
  page: number;
  perpage: number;
  sort?: "-created" | "created" | "score" | "-sort" | "title" | "-title" | "domain" | "-domain";
  search?: string;
  nested?: boolean;
  fields?: string[] | FieldPreset;
}

interface GetRaindropParams {
  id: number;
  fields?: string[] | FieldPreset;
}

interface CreateRaindropParams {
  link: string;
  title?: string;
  excerpt?: string;
  note?: string;
  tags?: string[];
  collectionId?: number;
  important?: boolean;
  pleaseParse: boolean;
  minimal: boolean;
}

interface UpdateRaindropParams {
  id: number;
  title?: string;
  excerpt?: string;
  note?: string;
  tags?: string[];
  link?: string;
  collectionId?: number;
  important?: boolean;
  order?: number;
  fields?: string[] | FieldPreset;
  minimal: boolean;
}

interface DeleteRaindropParams {
  id: number;
  minimal: boolean;
}

interface CreateRaindropsBulkParams {
  raindrops: Array<{
    link: string;
    title?: string;
    excerpt?: string;
    note?: string;
    tags?: string[];
    collectionId?: number;
    important?: boolean;
    pleaseParse?: boolean;
  }>;
  delayMs: number;
  continueOnError: boolean;
  minimal: boolean;
}

interface SearchRaindropsParams {
  search: string;
  collectionId: number;
  page: number;
  perpage: number;
  sort?: "-created" | "created" | "score" | "-sort" | "title" | "-title" | "domain" | "-domain";
  fields?: string[] | FieldPreset;
}

interface ListTagsParams {
  collectionId?: number;
  page: number;
  perpage: number;
  fields?: string[];
}

interface MergeTagsParams {
  tags: string[];
  newTag: string;
  collectionId?: number;
  minimal: boolean;
}

interface DeleteTagsParams {
  tags: string[];
  collectionId?: number;
  minimal: boolean;
}

interface ListHighlightsParams {
  collectionId?: number;
  page: number;
  perpage: number;
  fields?: string[];
}

interface ParseUrlParams {
  url: string;
}

interface CheckUrlExistsParams {
  urls: string[];
}

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

  private async handleResponse<T extends ApiResponse>(response: Response): Promise<T> {
    let data: unknown;
    try {
      data = await response.json() as unknown;
    } catch {
      throw new Error(`Failed to parse JSON response: ${response.status} ${response.statusText}`);
    }

    const parsedData = data as ApiResponse | RaindropApiError;

    if (!response.ok || parsedData.result === false) {
      const error = parsedData as RaindropApiError;
      throw new Error(
        error.errorMessage || error.error || `API request failed: ${response.status}`
      );
    }

    return cleanTitlesInData(parsedData) as T;
  }

  private buildUrl(path: string, params?: Record<string, JsonPrimitive>): string {
    const url = `${API_BASE_URL}${path}`;
    if (!params || Object.keys(params).length === 0) {return url;}

    const stringParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      stringParams[key] = String(value);
    }
    const queryString = new URLSearchParams(stringParams).toString();
    return `${url}?${queryString}`;
  }

  private async request<T extends ApiResponse>(
    url: string,
    options: { method?: string; body?: string } = {}
  ): Promise<T> {
    // Use globalThis.fetch for testability
    const fetchFn = (globalThis.fetch as unknown as typeof fetch) || fetch;
    const response = await fetchFn(url, { ...options, headers: this.headers });
    return this.handleResponse<T>(response as Response);
  }

  // Collections API
  async getCollections(root = true): Promise<CollectionsResponse> {
    const endpoint = root ? "/collections" : "/collections/childrens";
    return this.request<CollectionsResponse>(this.buildUrl(endpoint));
  }

  async getCollection(id: number): Promise<CollectionResponse> {
    return this.request<CollectionResponse>(this.buildUrl(`/collection/${id}`));
  }

  async createCollection(data: Partial<Collection> & { title: string }): Promise<CollectionResponse> {
    return this.request<CollectionResponse>(this.buildUrl("/collection"), {
      method: "POST",
      body: JSON.stringify(data)
    });
  }

  async updateCollection(id: number, data: Partial<Collection>): Promise<CollectionResponse> {
    return this.request<CollectionResponse>(this.buildUrl(`/collection/${id}`), {
      method: "PUT",
      body: JSON.stringify(data)
    });
  }

  async deleteCollection(id: number): Promise<{ result: boolean }> {
    return this.request<{ result: boolean }>(this.buildUrl(`/collection/${id}`), { method: "DELETE" });
  }

  // Raindrops API
  async getRaindrops(
    collectionId: number,
    params?: Record<string, JsonPrimitive>
  ): Promise<RaindropsResponse> {
    return this.request<RaindropsResponse>(this.buildUrl(`/raindrops/${collectionId}`, params));
  }

  async getRaindrop(id: number): Promise<RaindropResponse> {
    return this.request<RaindropResponse>(this.buildUrl(`/raindrop/${id}`));
  }

  async createRaindrop(data: Partial<Raindrop> & { link: string }): Promise<RaindropResponse> {
    return this.request<RaindropResponse>(this.buildUrl("/raindrop"), {
      method: "POST",
      body: JSON.stringify(data)
    });
  }

  async updateRaindrop(id: number, data: Partial<Raindrop>): Promise<RaindropResponse> {
    return this.request<RaindropResponse>(this.buildUrl(`/raindrop/${id}`), {
      method: "PUT",
      body: JSON.stringify(data)
    });
  }

  async deleteRaindrop(id: number): Promise<{ result: boolean }> {
    return this.request<{ result: boolean }>(this.buildUrl(`/raindrop/${id}`), { method: "DELETE" });
  }

  async searchRaindrops(
    collectionId: number,
    search: string,
    params?: Record<string, JsonPrimitive>
  ): Promise<RaindropsResponse> {
    return this.request<RaindropsResponse>(
      this.buildUrl(`/raindrops/${collectionId}`, { search, ...params })
    );
  }

  // Tags API
  async getTags(collectionId?: number, params?: Record<string, JsonPrimitive>): Promise<TagsResponse> {
    const path = collectionId !== undefined ? `/tags/${collectionId}` : "/tags";
    return this.request<TagsResponse>(this.buildUrl(path, params));
  }

  async mergeTags(
    tags: string[],
    newTag: string,
    collectionId?: number
  ): Promise<{ result: boolean }> {
    const path = collectionId !== undefined ? `/tags/${collectionId}` : "/tags";
    return this.request<{ result: boolean }>(this.buildUrl(path), {
      method: "PUT",
      body: JSON.stringify({ tags, replace: newTag })
    });
  }

  async deleteTags(tags: string[], collectionId?: number): Promise<{ result: boolean }> {
    const path = collectionId !== undefined ? `/tags/${collectionId}` : "/tags";
    return this.request<{ result: boolean }>(this.buildUrl(path), {
      method: "DELETE",
      body: JSON.stringify({ tags })
    });
  }

  // Highlights API
  async getHighlights(
    collectionId?: number,
    params?: Record<string, JsonPrimitive>
  ): Promise<HighlightsResponse> {
    const path = collectionId !== undefined ? `/highlights/${collectionId}` : "/highlights";
    return this.request<HighlightsResponse>(this.buildUrl(path, params));
  }

  // Import/Export API
  async parseUrl(url: string): Promise<ParseUrlResponse> {
    return this.request<ParseUrlResponse>(this.buildUrl("/import/url/parse", { url }));
  }

  async checkUrlExists(urls: string[]): Promise<CheckUrlExistsResponse> {
    return this.request<CheckUrlExistsResponse>(this.buildUrl("/import/url/exists"), {
      method: "POST",
      body: JSON.stringify({ urls })
    });
  }
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

function createSuccessResponse(text: string): ToolResponse {
  return { content: [{ type: "text", text }] };
}

function createJsonResponse(data: JsonValue): ToolResponse {
  return createSuccessResponse(JSON.stringify(data, null, 2));
}

function createErrorResponse(error: unknown): ToolResponse {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true
  };
}

function handleMinimalResponse<T extends JsonValue>(data: T, minimal?: boolean): ToolResponse {
  return minimal ? createSuccessResponse("ok") : createJsonResponse(data);
}

function handleMessageResponse(message: string, minimal?: boolean): ToolResponse {
  return createSuccessResponse(minimal ? "ok" : message);
}

// Helper function to delay execution
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// TOOL REGISTRATION WRAPPER
// ============================================================================

function toolHandler<T>(handler: (params: T) => Promise<ToolResponse>) {
  return async (params: T): Promise<ToolResponse> => {
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
    description: "Retrieve all bookmark collections (folders). Collections organize your bookmarks into categories. Set root=true for top-level collections or root=false for nested subcollections. Returns all collections without pagination.",
    inputSchema: listCollectionsSchema,
  },
  toolHandler<ListCollectionsParams>(async ({ root, fields }) => {
    const result = await client.getCollections(root);
    const filtered = filterApiResponse(result, fields);
    return createJsonResponse(filtered as JsonValue);
  })
);

server.registerTool(
  "get-collection",
  {
    title: "Get Collection",
    description: "Retrieve details of a specific collection by ID. Returns collection metadata including title, description, bookmark count, view style, public/private status, and parent collection (if nested). Supports custom field selection.",
    inputSchema: getCollectionSchema,
  },
  toolHandler<GetCollectionParams>(async ({ id, fields }) => {
    const result = await client.getCollection(id);
    const filtered = filterApiResponse(result, fields);
    return createJsonResponse(filtered as JsonValue);
  })
);

server.registerTool(
  "create-collection",
  {
    title: "Create Collection",
    description: "Create a new collection (folder) to organize bookmarks. Choose from view styles: 'list' (default compact), 'simple' (title only), 'grid' (cards with covers), or 'masonry' (Pinterest-style). Optionally nest under a parent collection, add description, set public sharing, and customize with cover images.",
    inputSchema: createCollectionSchema,
  },
  toolHandler<CreateCollectionParams>(async (params) => {
    const data: Partial<Collection> & { title: string } = {
      title: params.title,
      view: params.view,
      public: params.public,
    };

    if (params.description) {data.description = params.description;}
    if (params.parentId) {data.parent = { $id: params.parentId };}
    if (params.cover) {data.cover = params.cover;}

    const result = await client.createCollection(data);
    return handleMinimalResponse(result as unknown as JsonValue, params.minimal);
  })
);

server.registerTool(
  "update-collection",
  {
    title: "Update Collection",
    description: "Modify an existing collection's properties: rename, change description, switch view style, toggle public/private sharing, reorganize by changing parent, or expand/collapse nested subcollections in the UI.",
    inputSchema: updateCollectionSchema,
  },
  toolHandler<UpdateCollectionParams>(async ({ id, minimal, ...fields }) => {
    const data: Partial<Collection> = {};

    if (fields.title !== undefined) {data.title = fields.title;}
    if (fields.description !== undefined) {data.description = fields.description;}
    if (fields.parentId !== undefined) {data.parent = { $id: fields.parentId };}
    if (fields.view !== undefined) {data.view = fields.view;}
    if (fields.public !== undefined) {data.public = fields.public;}
    if (fields.expanded !== undefined) {data.expanded = fields.expanded;}

    const result = await client.updateCollection(id, data);
    return handleMinimalResponse(result as unknown as JsonValue, minimal);
  })
);

server.registerTool(
  "delete-collection",
  {
    title: "Delete Collection",
    description: "Permanently delete a collection and all nested subcollections. All bookmarks (raindrops) in the collection are moved to Trash (collection ID -99), not permanently deleted. The bookmarks can be restored or permanently deleted later.",
    inputSchema: deleteCollectionSchema,
  },
  toolHandler<DeleteCollectionParams>(async ({ id, minimal }) => {
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
    description: "List bookmarks (called 'raindrops' in Raindrop.io) from a collection with pagination. Special collection IDs: 0 (All bookmarks), -1 (Unsorted), -99 (Trash). Supports sorting, searching, nested collection traversal, and field presets (minimal/basic/standard/media/organization/metadata) for optimized responses.",
    inputSchema: listRaindropsSchema,
  },
  toolHandler<ListRaindropsParams>(async ({ collectionId, fields, ...queryParams }) => {
    const params = Object.fromEntries(
      Object.entries(queryParams).filter(([_, v]) => v !== undefined)
    ) as Record<string, JsonPrimitive>;

    const result = await client.getRaindrops(collectionId, params);
    const filtered = filterApiResponse(result, fields);
    return createJsonResponse(filtered as JsonValue);
  })
);

server.registerTool(
  "get-raindrop",
  {
    title: "Get Raindrop",
    description: "Retrieve a specific bookmark by ID. Returns complete details including URL, title, description, tags, notes, type (link/article/image/video/document/audio), cover image, creation date, and collection. Use field presets or custom arrays to optimize response size.",
    inputSchema: getRaindropSchema,
  },
  toolHandler<GetRaindropParams>(async ({ id, fields }) => {
    const result = await client.getRaindrop(id);
    const filtered = filterApiResponse(result, fields);
    return createJsonResponse(filtered as JsonValue);
  })
);

server.registerTool(
  "create-raindrop",
  {
    title: "Create Raindrop",
    description: "Save a new bookmark (raindrop). Provide a URL and optionally add title, description (excerpt), personal notes, tags, and mark as favorite (important). Set pleaseParse=true (default) to auto-extract metadata like title, description, and cover image from the URL. Bookmarks go to Unsorted (ID -1) unless a collection is specified.",
    inputSchema: createRaindropSchema,
  },
  toolHandler<CreateRaindropParams>(async (params) => {
    const data: Partial<Raindrop> & { link: string; pleaseParse?: Record<string, never> } = {
      link: params.link
    };

    if (params.title) {data.title = params.title;}
    if (params.excerpt) {data.excerpt = params.excerpt;}
    if (params.note) {data.note = params.note;}
    if (params.tags) {data.tags = params.tags;}
    if (params.collectionId !== undefined) {data.collection = { $id: params.collectionId };}
    if (params.important !== undefined) {data.important = params.important;}
    if (params.pleaseParse) {data.pleaseParse = {};}

    const result = await client.createRaindrop(data);
    return handleMinimalResponse(result as unknown as JsonValue, params.minimal);
  })
);

server.registerTool(
  "create-raindrops-bulk",
  {
    title: "Create Raindrops (Bulk)",
    description: "Create multiple bookmarks (raindrops) in a batch operation. Processes bookmarks sequentially with configurable delays to avoid rate limiting. Supports continue-on-error mode to process remaining bookmarks if one fails. Returns detailed results including success/failure counts, errors, and created bookmark details. Maximum 50 bookmarks per request.",
    inputSchema: createRaindropsBulkSchema,
  },
  toolHandler<CreateRaindropsBulkParams>(async ({ raindrops, delayMs, continueOnError, minimal }) => {
    const results = {
      total: raindrops.length,
      successful: 0,
      failed: 0,
      created: [] as Raindrop[],
      errors: [] as Array<{ index: number; link: string; error: string }>
    };

    for (let i = 0; i < raindrops.length; i++) {
      const raindrop = raindrops[i];

      try {
        // Add delay between requests (except for the first one)
        if (i > 0 && delayMs > 0) {
          await delay(delayMs);
        }

        const data: Partial<Raindrop> & { link: string; pleaseParse?: Record<string, never> } = {
          link: raindrop.link
        };

        if (raindrop.title) {data.title = raindrop.title;}
        if (raindrop.excerpt) {data.excerpt = raindrop.excerpt;}
        if (raindrop.note) {data.note = raindrop.note;}
        if (raindrop.tags) {data.tags = raindrop.tags;}
        if (raindrop.collectionId !== undefined) {data.collection = { $id: raindrop.collectionId };}
        if (raindrop.important !== undefined) {data.important = raindrop.important;}
        if (raindrop.pleaseParse) {data.pleaseParse = {};}

        const result = await client.createRaindrop(data);
        results.successful++;
        results.created.push(result.item);

      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.errors.push({
          index: i,
          link: raindrop.link,
          error: errorMessage
        });

        if (!continueOnError) {
          // Stop processing on first error if continueOnError is false
          break;
        }
      }
    }

    if (minimal) {
      return createJsonResponse({
        success: results.failed === 0,
        created: results.successful,
        failed: results.failed,
        total: results.total
      } as JsonValue);
    }

    return createJsonResponse({
      success: results.failed === 0,
      summary: {
        total: results.total,
        successful: results.successful,
        failed: results.failed
      },
      created: results.created,
      errors: results.errors.length > 0 ? results.errors : undefined
    } as JsonValue);
  })
);

server.registerTool(
  "update-raindrop",
  {
    title: "Update Raindrop",
    description: "Modify an existing bookmark: change title, description, notes, tags, URL, move to different collection, toggle favorite status, or adjust sort order. Tags parameter replaces all existing tags (not additive). Returns updated bookmark with optional field filtering.",
    inputSchema: updateRaindropSchema,
  },
  toolHandler<UpdateRaindropParams>(async ({ id, collectionId, fields, minimal, ...updates }) => {
    const data: Partial<Raindrop> = { ...updates };

    if (collectionId !== undefined) {
      data.collection = { $id: collectionId };
    }

    const result = await client.updateRaindrop(id, data);

    if (minimal) {
      return createSuccessResponse("ok");
    }

    const filtered = filterApiResponse(result, fields);
    return createJsonResponse(filtered as JsonValue);
  })
);

server.registerTool(
  "delete-raindrop",
  {
    title: "Delete Raindrop",
    description: "Delete a bookmark. First deletion moves the raindrop to Trash (collection ID -99) where it can be restored. Deleting a bookmark already in Trash permanently removes it from your account.",
    inputSchema: deleteRaindropSchema,
  },
  toolHandler<DeleteRaindropParams>(async ({ id, minimal }) => {
    await client.deleteRaindrop(id);
    return handleMessageResponse("Raindrop deleted successfully", minimal);
  })
);

server.registerTool(
  "search-raindrops",
  {
    title: "Search Raindrops",
    description: "Search bookmarks using Raindrop.io's powerful search syntax. Supports operators: #tag (search by tag), site:example.com (filter by domain), type:article/image/video (filter by content type), important:true (favorites only), created:YYYY-MM-DD (date filter), and more. Full-text search works on title, description, notes, and cached page content. Combine with pagination and field selection.",
    inputSchema: searchRaindropsSchema,
  },
  toolHandler<SearchRaindropsParams>(async ({ collectionId, search, fields, ...otherParams }) => {
    const params = Object.fromEntries(
      Object.entries(otherParams).filter(([_, v]) => v !== undefined)
    ) as Record<string, JsonPrimitive>;

    const result = await client.searchRaindrops(collectionId, search, params);
    const filtered = filterApiResponse(result, fields);
    return createJsonResponse(filtered as JsonValue);
  })
);

// ============================================================================
// TAG TOOLS
// ============================================================================

server.registerTool(
  "list-tags",
  {
    title: "List Tags",
    description: "Retrieve all tags used in your bookmarks, with usage counts. Optionally filter to tags from a specific collection. Tags help categorize and filter bookmarks across collections. Supports pagination and field selection.",
    inputSchema: listTagsSchema,
  },
  toolHandler<ListTagsParams>(async ({ collectionId, page, perpage, fields }) => {
    const params = Object.fromEntries(
      Object.entries({ page, perpage }).filter(([_, v]) => v !== undefined)
    ) as Record<string, JsonPrimitive>;

    const result = await client.getTags(collectionId, params);
    const filtered = filterApiResponse(result, fields);
    return createJsonResponse(filtered as JsonValue);
  })
);

server.registerTool(
  "merge-tags",
  {
    title: "Merge/Rename Tags",
    description: "Consolidate multiple tags into one or rename a tag. Useful for fixing typos (e.g., merge ['JavaScirpt', 'javascript'] into 'JavaScript') or organizing tags (merge ['react', 'reactjs'] into 'React'). All specified tags are replaced with newTag across affected bookmarks. Optionally scope to a specific collection.",
    inputSchema: mergeTagsSchema,
  },
  toolHandler<MergeTagsParams>(async ({ tags, newTag, collectionId, minimal }) => {
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
    description: "Remove one or more tags from all bookmarks. The tags are deleted entirely; bookmarks that had these tags will no longer have them. Use collectionId to limit deletion to bookmarks in a specific collection, or omit to delete tags globally.",
    inputSchema: deleteTagsSchema,
  },
  toolHandler<DeleteTagsParams>(async ({ tags, collectionId, minimal }) => {
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
    description: "Retrieve text highlights and annotations from saved articles and web pages. Highlights are text selections you've marked while reading bookmarked content. Each highlight can include the selected text, optional notes, color coding, and timestamps. Supports pagination and field selection. Filter by collection or get all highlights.",
    inputSchema: listHighlightsSchema,
  },
  toolHandler<ListHighlightsParams>(async ({ collectionId, fields, ...queryParams }) => {
    const params = Object.fromEntries(
      Object.entries(queryParams).filter(([_, v]) => v !== undefined)
    ) as Record<string, JsonPrimitive>;

    const result = await client.getHighlights(collectionId, params);
    const filtered = filterApiResponse(result, fields);
    return createJsonResponse(filtered as JsonValue);
  })
);

// ============================================================================
// URL PARSING TOOLS
// ============================================================================

server.registerTool(
  "parse-url",
  {
    title: "Parse URL",
    description: "Extract metadata from a URL before saving it as a bookmark. Returns the page title, description (excerpt), cover image, and content type (article/image/video/etc.). Useful for previewing what will be saved or getting metadata without creating a bookmark. This is the same parser used when pleaseParse=true in create-raindrop.",
    inputSchema: parseUrlSchema,
  },
  toolHandler<ParseUrlParams>(async ({ url }) => {
    const result = await client.parseUrl(url);
    return createJsonResponse(result as unknown as JsonValue);
  })
);

server.registerTool(
  "check-url-exists",
  {
    title: "Check URL Exists",
    description: "Check if one or more URLs are already bookmarked in your account before saving them. Prevents duplicate bookmarks. Returns raindrop IDs for URLs that exist and identifies duplicates. Useful for bulk import operations or validating links before adding them.",
    inputSchema: checkUrlExistsSchema,
  },
  toolHandler<CheckUrlExistsParams>(async ({ urls }) => {
    const result = await client.checkUrlExists(urls);
    return createJsonResponse(result as unknown as JsonValue);
  })
);

// ============================================================================
// SERVER STARTUP
// ============================================================================

async function main(): Promise<void> {
  debugLog("main() called, creating transport...");
  const transport = new StdioServerTransport();
  debugLog("Transport created, connecting server...");
  await server.connect(transport);
  debugLog("Server connected successfully!");
  console.error("Raindrop.io MCP server running on stdio");
}

// Start the server
debugLog("Starting main()...");
main().catch((error: unknown) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

// ============================================================================
// EXPORTS FOR TESTING
// ============================================================================

export {
  cleanTitle,
  cleanTitlesInData,
  safeJsonParse,
  resolveFieldList,
  filterObjectFields,
  filterFields,
  filterApiResponse,
  RaindropClient,
  FIELD_PRESETS,
  createSuccessResponse,
  createJsonResponse,
  createErrorResponse,
  handleMinimalResponse,
  handleMessageResponse,
  toolHandler,
};

export type {
  FieldPreset,
  FieldFilter,
  Collection,
  Raindrop,
  Tag,
  Highlight,
  CollectionsResponse,
  CollectionResponse,
  RaindropsResponse,
  RaindropResponse,
  TagsResponse,
  HighlightsResponse,
  ParseUrlResponse,
  CheckUrlExistsResponse,
  ApiResponse,
  ToolResponse,
};
