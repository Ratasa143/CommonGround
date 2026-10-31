# Meko MCP tools

Direct tools/list result captured on 2026-10-31T17:24:02.704Z.

## knowledgebase_search

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Natural language description of what to find."
    },
    "conversation_id": {
      "type": "string",
      "description": "Conversation id from stored chat; nests the trace."
    },
    "datapack_id": {
      "type": "string",
      "description": "UUID of the datapack to search within."
    },
    "agent_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Agent identifier scoping the search."
    },
    "limit": {
      "default": 10,
      "type": "integer",
      "description": "Maximum number of results to return (default 10)."
    },
    "skip_conversation": {
      "default": false,
      "type": "boolean",
      "description": "Deprecated, no-op. Conversation-history checking\nwas removed from this tool; this parameter is kept only so\nexisting callers (e.g. the inference gateway's \"Regenerate with\nfull search\" flow) don't break while they migrate off it."
    }
  },
  "required": [
    "query",
    "conversation_id",
    "datapack_id"
  ],
  "additionalProperties": false
}
```

## knowledgebase_delete_document

```json
{
  "type": "object",
  "properties": {
    "document_id": {
      "type": "string",
      "description": "UUID of the document to delete."
    },
    "conversation_id": {
      "type": "string",
      "description": "UUID from conversation_create, for trace nesting."
    },
    "datapack_id": {
      "default": "",
      "type": "string",
      "description": "UUID of the datapack. If omitted, the caller's active\ndatapack is used."
    }
  },
  "required": [
    "document_id",
    "conversation_id"
  ],
  "additionalProperties": false
}
```

## context_search

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Natural language description of what to find."
    },
    "conversation_id": {
      "type": "string",
      "description": "Conversation id from stored chat; nests the trace."
    },
    "agent_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Agent identifier scoping memory/conversation lookups."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "UUID of the datapack to search within."
    },
    "limit": {
      "default": 10,
      "type": "integer",
      "description": "Maximum number of results to return per source (default 10)."
    },
    "force_source": {
      "default": "auto",
      "type": "string",
      "description": "``\"auto\"`` (default, all three) or ``\"conversation\"``\n/ ``\"memory\"`` / ``\"knowledge_base\"`` — see above."
    },
    "prompt": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional. What the user asked, when ``query`` is a rewrite of\nit. Recorded in the datapack's search log; it does not change\nthe search."
    },
    "verify": {
      "default": false,
      "type": "boolean",
      "description": "Optional, default false. A replay of a saved search: it is\nrecorded in the event log marked verify, and is not counted in the\nowner's search log, daily counts or token-savings statistics, but it\ncounts against the user's search limit like any other search. It\nreturns the normal result. Leave it off for a real question."
    }
  },
  "required": [
    "query",
    "conversation_id"
  ],
  "additionalProperties": false
}
```

## memory_add

```json
{
  "type": "object",
  "properties": {
    "text": {
      "type": "string",
      "description": "Plain text content to store as a memory."
    },
    "conversation_id": {
      "type": "string",
      "description": "UUID from ``conversation_create``. Required for\ntrace nesting."
    },
    "agent_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Agent identifier. Determines which isolated\nvector collection the memory is stored in. Coding agents use\n``<client>:<repo-basename>`` (e.g. ``claude_code:myrepo``);\nother clients use a stable client name (e.g.\n``claude_desktop``); omit for the cross-project\n``meko_agent`` bucket."
    },
    "run_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional. Langfuse **trace metadata only** — it is attached\nas a trace tag and is NOT persisted on the memory row, so it\ndoes not scope the write and cannot be used to retrieve it. The\nrow's filterable conversation tag comes from\n``conversation_id`` alone; to read these memories back with a\nconversation filter, pass that ``conversation_id`` as\n``memory_search(run_id=…)``."
    },
    "metadata": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional JSON string of arbitrary metadata to attach."
    },
    "messages": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional JSON string of conversation history as a list\nof ``{\"role\": \"...\", \"content\": \"...\"}`` objects. When\nprovided, this is used instead of wrapping ``text`` as a\nsingle user message."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null
    }
  },
  "required": [
    "text",
    "conversation_id"
  ],
  "additionalProperties": false
}
```

## memory_delete_by_id

```json
{
  "type": "object",
  "properties": {
    "memory_id": {
      "type": "string",
      "description": "UUID of the memory to delete. Obtain from the ``id`` field\nreturned by memory_search or memory_get_all."
    },
    "conversation_id": {
      "type": "string",
      "description": "UUID from conversation_create, for trace nesting."
    },
    "agent_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Agent identifier whose memory store contains this memory.\nMust match the writer's `agent_id`."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null
    }
  },
  "required": [
    "memory_id",
    "conversation_id"
  ],
  "additionalProperties": false
}
```

## memory_search

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Natural language description of what to find."
    },
    "conversation_id": {
      "type": "string",
      "description": "Used purely for Langfuse trace nesting (so the\nsearch call appears under the active conversation in\ntraces). Does not filter results; pass ``run_id`` to filter."
    },
    "agent_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Agent identifier. NOTE: memory_search is cross-agent — it\nsearches every agent's memories in the datapack regardless of this\nvalue (results are scoped by datapack + user, not by agent_id), so\nyou will see rows written by other clients. The value is used only\nfor trace attribution. For naming, coding agents use\n\"<client>:<repo-basename>\", Claude Desktop uses \"claude_desktop\"."
    },
    "limit": {
      "default": 10,
      "type": "integer",
      "description": "Maximum number of results to return (default 10)."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional. UUID of the datapack to search within. Defaults\nto the caller's default datapack when omitted."
    },
    "run_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional. Restricts the search to memories tagged with\nthis ``meko_conversation_id``. Omit for cross-conversation\nresults."
    }
  },
  "required": [
    "query",
    "conversation_id"
  ],
  "additionalProperties": false
}
```

## memory_get_by_id

```json
{
  "type": "object",
  "properties": {
    "memory_id": {
      "type": "string",
      "description": "UUID of the memory to fetch. Obtain from the ``id`` field\nreturned by memory_search or memory_get_all — must be a valid UUID,\nnot an arbitrary string."
    },
    "conversation_id": {
      "type": "string",
      "description": "UUID from conversation_create, for trace nesting."
    },
    "agent_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Agent identifier whose memory store contains this memory."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null
    }
  },
  "required": [
    "memory_id",
    "conversation_id"
  ],
  "additionalProperties": false
}
```

## memory_get_all

```json
{
  "type": "object",
  "properties": {
    "conversation_id": {
      "type": "string",
      "description": "UUID from conversation_create, for trace nesting."
    },
    "agent_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Agent identifier, used for trace attribution. NOTE: this\nlisting is scoped by datapack + user, not filtered by agent_id, so\nit returns memories written by any client. For naming, coding\nagents use \"<client>:<repo-basename>\", Claude Desktop uses\n\"claude_desktop\"."
    },
    "run_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional run identifier (ignored, kept for backward compatibility)."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null
    },
    "promoted": {
      "default": false,
      "type": "boolean",
      "description": "If True, return promoted memories (GET /promoted-memories).\nIf False (default), return regular memories (GET /memories)."
    },
    "page": {
      "anyOf": [
        {
          "type": "integer"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional 1-based page number. Defaults to 1."
    },
    "page_size": {
      "anyOf": [
        {
          "type": "integer"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional rows per page. Defaults to 20; the server caps it\nat 100, and the response's ``page_size`` shows the value used."
    }
  },
  "required": [
    "conversation_id"
  ],
  "additionalProperties": false
}
```

## memory_promote

```json
{
  "type": "object",
  "properties": {
    "conversation_id": {
      "type": "string",
      "description": "UUID from conversation_create, for trace nesting."
    },
    "memory_ids": {
      "items": {
        "type": "string"
      },
      "type": "array",
      "description": "UUIDs to promote. Obtain from the ``id`` field returned by\nmemory_search or memory_get_all — must be valid UUIDs, not an\narbitrary string."
    },
    "agent_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Agent identifier whose memories these are."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Target datapack. Defaults to the caller's default datapack."
    }
  },
  "required": [
    "conversation_id",
    "memory_ids"
  ],
  "additionalProperties": false
}
```

## memory_update

```json
{
  "type": "object",
  "properties": {
    "memory_id": {
      "type": "string",
      "description": "UUID of the memory to update. Obtain from the ``id`` field\nreturned by memory_search or memory_get_all — must be a valid UUID,\nnot an arbitrary string."
    },
    "text": {
      "type": "string",
      "description": "Replacement text for the memory."
    },
    "conversation_id": {
      "type": "string",
      "description": "UUID from conversation_create, for trace nesting."
    },
    "agent_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Agent identifier whose memory store contains this memory.\nMust match the writer's `agent_id`."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null
    }
  },
  "required": [
    "memory_id",
    "text",
    "conversation_id"
  ],
  "additionalProperties": false
}
```

## memory_delete_all

```json
{
  "type": "object",
  "properties": {
    "conversation_id": {
      "type": "string",
      "description": "UUID from conversation_create, for trace nesting."
    },
    "agent_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Agent identifier whose memories to delete. Defaults to\n``meko_agent``."
    },
    "run_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional. Narrows the delete to rows tagged with this\n`meko_conversation_id`. Normalized the same way as\n`memory_search(run_id=…)`, so a search preview and this delete\ntarget the same rows. Must be a conversation id (32 lowercase hex\nchars, hyphens optional); anything else returns `invalid_run_id`\nrather than falling back to deleting every memory for the agent."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Datapack to delete from. Defaults to your default\ndatapack. A stdio server has no default, so pass it there."
    }
  },
  "required": [
    "conversation_id"
  ],
  "additionalProperties": false
}
```

## conversation_create

```json
{
  "type": "object",
  "properties": {
    "agent_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Agent identifier. Conversations are scoped per agent.\nUse a consistent ID across calls for the same agent. Coding\nagents use ``<client>:<repo-basename>`` (e.g.\n``claude_code:myrepo``); other clients use a stable client\nname (e.g. ``claude_desktop``)."
    },
    "run_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional run identifier."
    },
    "title": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional human-readable title for the conversation."
    },
    "metadata": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional JSON string of arbitrary metadata to attach."
    },
    "session_id": {
      "default": "",
      "type": "string",
      "description": "Optional session ID used as the conversation-container\ndedup key. When supplied it is HONORED so callers that derive a\nstable id (e.g. a Codex rollout basename) reconnect the same\nconversation instead of creating a duplicate. If omitted, a new\nUUID is generated. Non-hex ids are normalized deterministically\ninto a valid 32-hex Langfuse trace id (same seed -> same id), so\nthe returned conversation ``id`` may differ from the raw input\nwhile still deduplicating consistently across callers."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "UUID of the datapack whose Langfuse project stores\nthe conversation. Required whenever no server-side default\nresolves for the caller. Use ``datapack_search(query=...)`` to look up\nthe id. Calls without ``datapack_id`` and without a resolved\ndefault return ``{\"error\": \"datapack_id_required\"}`` and\npersist nothing."
    }
  },
  "additionalProperties": false
}
```

## conversation_add_message

```json
{
  "type": "object",
  "properties": {
    "conversation_id": {
      "type": "string",
      "description": "UUID returned by ``conversation_create``."
    },
    "input": {
      "type": "string",
      "description": "The user's prompt or question."
    },
    "output": {
      "type": "string",
      "description": "The assistant's response."
    },
    "agent_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Agent identifier. Must match the ``agent_id`` used in\n``conversation_create``."
    },
    "reasoning": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional short paragraph (1–3 sentences) explaining\nthe *why* behind the reply. Plain text; inline markdown\nallowed."
    },
    "metadata": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional JSON string of arbitrary metadata to attach."
    },
    "seed": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional seed string for deterministic message ID. When\nboth a hook and the MCP server use the same seed, they\nproduce the same message ID, enabling deduplication."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "UUID of the datapack whose Langfuse project stores\nthe message. Required whenever no server-side default\nresolves for the caller. Use ``datapack_search(query=...)`` to look up\nthe id. Calls without ``datapack_id`` and without a resolved\ndefault return ``{\"error\": \"datapack_id_required\"}`` and\npersist nothing."
    },
    "plan": {
      "default": null,
      "items": {
        "type": "string"
      },
      "type": "array",
      "description": "Optional list of 2–4 imperative, single-sentence actions\ntaken for this turn. Pass a list of strings; do not\npre-number entries."
    }
  },
  "required": [
    "conversation_id",
    "input",
    "output"
  ],
  "additionalProperties": false
}
```

## conversation_get

```json
{
  "type": "object",
  "properties": {
    "conversation_id": {
      "type": "string",
      "description": "UUID of the conversation to fetch."
    },
    "agent_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Agent identifier. Only returns the conversation if it\nbelongs to this agent."
    },
    "include_messages": {
      "default": false,
      "type": "boolean",
      "description": "Set True to include the full message history\n(input, output, reasoning). Default False returns metadata only."
    },
    "limit": {
      "default": 100,
      "type": "integer",
      "description": "Max number of messages to return (default 100)."
    },
    "offset": {
      "default": 0,
      "type": "integer",
      "description": "Number of messages to skip (default 0)."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "UUID of the datapack whose Langfuse project holds\nthe conversation. Required whenever no server-side default\nresolves for the caller. Use ``datapack_search(query=...)`` to look up\nthe id. Calls without ``datapack_id`` and without a resolved\ndefault return ``{\"error\": \"datapack_id_required\"}``."
    }
  },
  "required": [
    "conversation_id"
  ],
  "additionalProperties": false
}
```

## conversation_list

```json
{
  "type": "object",
  "properties": {
    "agent_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Agent identifier (used for trace attribution only)."
    },
    "limit": {
      "default": 20,
      "type": "integer",
      "description": "Max number of conversations to return (default 20)."
    },
    "offset": {
      "default": 0,
      "type": "integer",
      "description": "Number of conversations to skip for pagination (default 0)."
    },
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Optional. Pass the active conversation_id to nest\nthe list-call's trace under it, or omit — listing does not\ndepend on a specific conversation. When omitted, the call gets\nits own ephemeral trace session so it still appears in Langfuse\nbut is not falsely attributed to an unrelated conversation."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "UUID of the datapack whose conversations to list. If\nomitted, the caller's default datapack is used. Use\n``datapack_search(query=...)`` to look up the id."
    }
  },
  "additionalProperties": false
}
```

## conversation_update

```json
{
  "type": "object",
  "properties": {
    "conversation_id": {
      "type": "string",
      "description": "UUID of the conversation to update."
    },
    "agent_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Agent identifier. Only updates if the conversation\nbelongs to this agent."
    },
    "title": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "New title (pass to change, omit to keep)."
    },
    "metadata": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "New metadata as a JSON string (pass to replace, omit to keep)."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "UUID of the datapack whose Langfuse project holds\nthe conversation. Required whenever no server-side default\nresolves for the caller. Use ``datapack_search(query=...)`` to look up\nthe id. Calls without ``datapack_id`` and without a resolved\ndefault return ``{\"error\": \"datapack_id_required\"}``."
    }
  },
  "required": [
    "conversation_id"
  ],
  "additionalProperties": false
}
```

## conversation_delete

```json
{
  "type": "object",
  "properties": {
    "conversation_id": {
      "type": "string",
      "description": "UUID of the conversation to delete."
    },
    "agent_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Agent identifier. Only deletes if the conversation\nbelongs to this agent."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "UUID of the datapack whose Langfuse project holds\nthe conversation. Required whenever no server-side default\nresolves for the caller. Use ``datapack_search(query=...)`` to look up\nthe id. Calls without ``datapack_id`` and without a resolved\ndefault return ``{\"error\": \"datapack_id_required\"}``."
    }
  },
  "required": [
    "conversation_id"
  ],
  "additionalProperties": false
}
```

## datapack_create

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Name for the new datapack.  Must be unique across the platform."
    },
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Langfuse conversation id from stored chat; nests the trace."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional UUID of a datapack for Langfuse project routing."
    }
  },
  "required": [
    "name"
  ],
  "additionalProperties": false
}
```

## datapack_list

```json
{
  "type": "object",
  "properties": {
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Langfuse conversation id from stored chat; nests the trace."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional UUID of a datapack for Langfuse project routing."
    },
    "query": {
      "default": "",
      "type": "string",
      "description": "Optional case-insensitive substring of the datapack name."
    },
    "limit": {
      "default": 0,
      "type": "integer",
      "description": "Optional maximum number of rows, capped at 100. With ``limit``\nthe result is the first ``limit`` matches and does not say\nwhether more exist; ``datapack_search`` returns ``has_more``."
    }
  },
  "additionalProperties": false
}
```

## datapack_search

```json
{
  "type": "object",
  "properties": {
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Langfuse conversation id from stored chat; nests the trace."
    },
    "query": {
      "default": "",
      "type": "string",
      "description": "Case-insensitive substring of the datapack name (max 200 chars)."
    },
    "name": {
      "default": "",
      "type": "string",
      "description": "Exact datapack name."
    },
    "limit": {
      "default": 20,
      "type": "integer",
      "description": "Rows per page, 1-100 (default 20). Out-of-range values are clamped."
    },
    "cursor": {
      "default": "",
      "type": "string",
      "description": "``next_cursor`` from the previous page. Empty for the first page."
    },
    "grant": {
      "default": "",
      "type": "string",
      "description": "``owner`` (datapacks you own), ``shared`` (shared with you), or\nempty for both."
    },
    "sort": {
      "default": "created",
      "type": "string",
      "description": "``created`` (newest first, default) or ``name`` (A-Z)."
    },
    "include_total": {
      "default": false,
      "type": "boolean",
      "description": "Also return how many datapacks match, in ``total``."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional UUID of a datapack for Langfuse project routing."
    }
  },
  "additionalProperties": false
}
```

## datapack_describe

```json
{
  "type": "object",
  "properties": {
    "datapack_id": {
      "default": "",
      "type": "string",
      "description": "UUID of the datapack to describe. If omitted, the caller's\ndefault datapack is used. Use ``datapack_search(query=...)`` to look up the id."
    },
    "include_status": {
      "default": false,
      "type": "boolean",
      "description": "Set True to also fetch agent_count, knowledge_base_count,\nand provisioning status. Default False."
    },
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Langfuse conversation id from stored chat; nests the trace."
    }
  },
  "additionalProperties": false
}
```

## datapack_update

```json
{
  "type": "object",
  "properties": {
    "datapack_id": {
      "type": "string",
      "description": "UUID of the datapack to update. Use ``datapack_search(query=...)`` to\nlook up the id."
    },
    "name": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "New human-readable datapack name. Optional."
    },
    "description": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "New human-readable datapack description. Optional."
    },
    "conversation_search_opt_out": {
      "anyOf": [
        {
          "type": "boolean"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "True to stop indexing this datapack's\nfuture conversation turns for search; False to re-enable. Optional."
    },
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Langfuse conversation id from stored chat; nests the trace."
    }
  },
  "required": [
    "datapack_id"
  ],
  "additionalProperties": false
}
```

## datapack_delete

```json
{
  "type": "object",
  "properties": {
    "datapack_id": {
      "type": "string",
      "description": "UUID of the datapack to delete. Required — there is no\ndefault to avoid deleting the wrong datapack. Use ``datapack_search(query=...)``\nto look up the id."
    },
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Langfuse conversation id from stored chat; nests the trace."
    }
  },
  "required": [
    "datapack_id"
  ],
  "additionalProperties": false
}
```

## track_token_usage

```json
{
  "type": "object",
  "properties": {
    "conversation_id": {
      "type": "string",
      "description": "UUID from conversation_create. Determines\nwhich trace the observation hangs off."
    },
    "name": {
      "type": "string",
      "description": "Short label for the observation — used both in the\nLangfuse UI and to disambiguate token sinks in dashboards.\nRecommended: \"LLM Response\", \"LLM Summarization\",\n\"Entity Extraction\", \"Embedding (KB query)\",\n\"Embedding (conversation)\"."
    },
    "input_tokens": {
      "default": 0,
      "type": "integer",
      "description": "Prompt / input token count from the provider's\nusage payload."
    },
    "output_tokens": {
      "default": 0,
      "type": "integer",
      "description": "Completion / output token count. 0 for embeddings."
    },
    "total_tokens": {
      "anyOf": [
        {
          "type": "integer"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Provider-reported total. Defaults to\ninput + output when omitted (matches OpenAI's convention)."
    },
    "model": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional model identifier (e.g. \"gpt-4o-mini\",\n\"text-embedding-3-small\"). Shown in the Langfuse UI."
    },
    "message_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional message UUID returned by\n``conversation_add_message``. When provided, the\nobservation's metadata carries it so token spend can be\ncorrelated to a specific turn (per-turn rollups, etc.)."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Routes to the correct tenant's Langfuse project.\nOmit to use the default datapack for the request context."
    }
  },
  "required": [
    "conversation_id",
    "name"
  ],
  "additionalProperties": false
}
```

## artifact_put

```json
{
  "type": "object",
  "properties": {
    "filename": {
      "type": "string",
      "description": "Original filename including extension (e.g. \"report.pdf\")."
    },
    "content_base64": {
      "type": "string",
      "description": "Base64-encoded file bytes."
    },
    "content_type": {
      "type": "string",
      "description": "MIME type (e.g. \"application/pdf\", \"text/csv\")."
    },
    "conversation_id": {
      "type": "string",
      "description": "Langfuse conversation id for trace nesting."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Target datapack UUID. Defaults to the caller's default datapack."
    },
    "agent_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Agent identifier for trace attribution."
    }
  },
  "required": [
    "filename",
    "content_base64",
    "content_type",
    "conversation_id"
  ],
  "additionalProperties": false
}
```

## artifact_get

```json
{
  "type": "object",
  "properties": {
    "content_hash": {
      "type": "string",
      "description": "SHA-256 hex returned by artifact_put."
    },
    "conversation_id": {
      "type": "string",
      "description": "Langfuse conversation id for trace nesting."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Datapack UUID. Defaults to the caller's default datapack."
    },
    "agent_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Agent identifier for trace attribution."
    }
  },
  "required": [
    "content_hash",
    "conversation_id"
  ],
  "additionalProperties": false
}
```

## knowledgebase_upload_document

```json
{
  "type": "object",
  "properties": {
    "filename": {
      "type": "string",
      "description": "Original filename including extension (e.g. \"report.pdf\")."
    },
    "size": {
      "type": "integer",
      "description": "The file's exact size in bytes."
    },
    "content_hash": {
      "type": "string",
      "description": "SHA-256 hex digest of the file's bytes (e.g. `sha256sum` locally)."
    },
    "conversation_id": {
      "type": "string",
      "description": "Langfuse conversation id for trace nesting."
    },
    "content_head_base64": {
      "type": "string",
      "description": "Base64 of the file's first 3072 bytes (the whole\n           file if shorter). Required."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Target datapack UUID. Defaults to the caller's default datapack."
    },
    "agent_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Agent identifier for trace attribution."
    }
  },
  "required": [
    "filename",
    "size",
    "content_hash",
    "conversation_id",
    "content_head_base64"
  ],
  "additionalProperties": false
}
```

## knowledgebase_document_status

```json
{
  "type": "object",
  "properties": {
    "document_key": {
      "type": "string",
      "description": "The `key` field from knowledgebase_upload_document's response."
    },
    "conversation_id": {
      "type": "string",
      "description": "Langfuse conversation id for trace nesting."
    },
    "datapack_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Datapack UUID. Defaults to the caller's default datapack."
    },
    "agent_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Agent identifier for trace attribution."
    }
  },
  "required": [
    "document_key",
    "conversation_id"
  ],
  "additionalProperties": false
}
```

## amp_cluster_create

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Cluster (database) name."
    },
    "datapack_id": {
      "default": "",
      "type": "string",
      "description": "UUID of the datapack. If omitted, the caller's active\ndatapack is used. Use ``datapack_search(query=...)`` to look one up."
    },
    "pg_version": {
      "anyOf": [
        {
          "type": "integer"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional Postgres major version. Omit to take AMP's default;\nonly the default version is currently accepted."
    },
    "with_writer": {
      "default": false,
      "type": "boolean",
      "description": "Also provision the ``main``-branch ``read_write`` endpoint\nin the same task. Default False (cluster only)."
    },
    "cpu": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Endpoint CPU reservation, a Kubernetes quantity (e.g. \"2\",\n\"500m\"). Only used with ``with_writer=True``; omit for the\n0.5-vCPU default."
    },
    "memory": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Endpoint memory reservation (e.g. \"8Gi\"). Only used with\n``with_writer=True``. Omit to derive it from ``cpu`` at AMP's\nrequired 8 GiB per vCPU (4Gi at the 0.5-vCPU default)."
    },
    "password": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "cloud_admin password for the writer (``with_writer=True``\nonly). Omit and a strong one is generated and returned once as\n``cloud_admin_password`` — the control plane keeps only the SCRAM\nverifier, so it cannot be recovered later. Printable ASCII, 8-128."
    },
    "connectivity_mode": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "exposure of the ``with_writer`` endpoint.\n``nlb_external`` gives it a public, internet-facing address so a\nclient OUTSIDE the cluster can connect; omit for the in-cluster\ndefault. Only used with ``with_writer=True``, and it is a create-time\nchoice — it cannot be changed afterwards, so decide it now. Requires\n``allowed_cidrs``."
    },
    "allowed_cidrs": {
      "anyOf": [
        {
          "items": {
            "type": "string"
          },
          "type": "array"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "source IP allow-list for ``nlb_external`` (CIDRs, each with an\nexplicit prefix, e.g. ``[\"203.0.113.4/32\"]``). REQUIRED when\n``connectivity_mode`` is ``nlb_external``. **Ask the user for the IP(s) to\nallow** — a public endpoint with no allow-list is refused, and so is any\nentry broader than /24 (IPv4) or /48 (IPv6), an unspecified/default\nnetwork, or an IPv4-mapped IPv6 range."
    },
    "engine": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional cluster engine (\"postgres\" default, \"aidb\", \"oracle\")."
    },
    "extensions": {
      "anyOf": [
        {
          "items": {
            "type": "string"
          },
          "type": "array"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Optional catalog extensions to seed on the default branch."
    },
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Langfuse conversation id from stored chat; nests the trace."
    }
  },
  "required": [
    "name"
  ],
  "additionalProperties": false
}
```

## amp_cluster_list

```json
{
  "type": "object",
  "properties": {
    "datapack_id": {
      "default": "",
      "type": "string",
      "description": "UUID of the datapack. Defaults to the active datapack."
    },
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Langfuse conversation id from stored chat; nests the trace."
    }
  },
  "additionalProperties": false
}
```

## amp_cluster_get

```json
{
  "type": "object",
  "properties": {
    "cluster_id": {
      "type": "string",
      "description": "UUID of the cluster. Use ``amp_cluster_list`` to find it."
    },
    "datapack_id": {
      "default": "",
      "type": "string",
      "description": "UUID of the datapack. Defaults to the active datapack."
    },
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Langfuse conversation id from stored chat; nests the trace."
    }
  },
  "required": [
    "cluster_id"
  ],
  "additionalProperties": false
}
```

## amp_cluster_delete

```json
{
  "type": "object",
  "properties": {
    "cluster_id": {
      "type": "string",
      "description": "UUID of the cluster to delete. Use ``amp_cluster_list`` to find it."
    },
    "datapack_id": {
      "default": "",
      "type": "string",
      "description": "UUID of the datapack. Defaults to the active datapack."
    },
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Langfuse conversation id from stored chat; nests the trace."
    }
  },
  "required": [
    "cluster_id"
  ],
  "additionalProperties": false
}
```

## amp_branch_create

```json
{
  "type": "object",
  "properties": {
    "cluster_id": {
      "type": "string",
      "description": "UUID of the cluster to branch. Use ``amp_cluster_list``."
    },
    "name": {
      "type": "string",
      "description": "Name for the new branch."
    },
    "parent_branch_id": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Branch to fork from. Omit to fork the cluster's default\nbranch (\"main\")."
    },
    "fork_point_lsn": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Ancestor LSN to fork at (\"X/X\" hex). Omit for the\nparent's latest; required when the parent has no running compute the\ncontroller can read the flush LSN from."
    },
    "datapack_id": {
      "default": "",
      "type": "string",
      "description": "UUID of the datapack. Defaults to the active datapack."
    },
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Langfuse conversation id from stored chat; nests the trace."
    }
  },
  "required": [
    "cluster_id",
    "name"
  ],
  "additionalProperties": false
}
```

## amp_branch_list

```json
{
  "type": "object",
  "properties": {
    "cluster_id": {
      "type": "string",
      "description": "UUID of the cluster. Use ``amp_cluster_list`` to find it."
    },
    "datapack_id": {
      "default": "",
      "type": "string",
      "description": "UUID of the datapack. Defaults to the active datapack."
    },
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Langfuse conversation id from stored chat; nests the trace."
    }
  },
  "required": [
    "cluster_id"
  ],
  "additionalProperties": false
}
```

## amp_branch_get

```json
{
  "type": "object",
  "properties": {
    "cluster_id": {
      "type": "string",
      "description": "UUID of the cluster. Use ``amp_cluster_list`` to find it."
    },
    "branch_id": {
      "type": "string",
      "description": "UUID of the branch. Use ``amp_branch_list`` to find it."
    },
    "datapack_id": {
      "default": "",
      "type": "string",
      "description": "UUID of the datapack. Defaults to the active datapack."
    },
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Langfuse conversation id from stored chat; nests the trace."
    }
  },
  "required": [
    "cluster_id",
    "branch_id"
  ],
  "additionalProperties": false
}
```

## amp_branch_delete

```json
{
  "type": "object",
  "properties": {
    "cluster_id": {
      "type": "string",
      "description": "UUID of the cluster. Use ``amp_cluster_list`` to find it."
    },
    "branch_id": {
      "type": "string",
      "description": "UUID of the branch to delete. Use ``amp_branch_list`` to find it."
    },
    "datapack_id": {
      "default": "",
      "type": "string",
      "description": "UUID of the datapack. Defaults to the active datapack."
    },
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Langfuse conversation id from stored chat; nests the trace."
    }
  },
  "required": [
    "cluster_id",
    "branch_id"
  ],
  "additionalProperties": false
}
```

## amp_compute_create

```json
{
  "type": "object",
  "properties": {
    "cluster_id": {
      "type": "string",
      "description": "UUID of the cluster. Use ``amp_cluster_list`` to find it."
    },
    "branch_id": {
      "type": "string",
      "description": "UUID of the branch. Use ``amp_branch_list`` to find it."
    },
    "role": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "``read_write`` (default) or ``read_only``."
    },
    "cpu": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "CPU reservation, a Kubernetes quantity (e.g. \"2\", \"1500m\"). Omit\nfor the 0.5-vCPU default (sized to fit the free tier); tell the\nuser the default was applied and offer a different size."
    },
    "memory": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Memory reservation (e.g. \"8Gi\"). Omit to derive it from\n``cpu`` at AMP's required 8 GiB per vCPU (4Gi at the 0.5-vCPU\ndefault); a memory-only call derives ``cpu`` from it the same way."
    },
    "password": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "cloud_admin password for a ``read_write`` endpoint. Omit it and\na strong one is generated and returned once as ``cloud_admin_password``\n— the control plane keeps only the verifier, so it cannot be recovered\nlater. A ``read_only`` endpoint takes no password. MEKO-1017 handling:\na FORK's writer (``password_required: false``) reuses the parent\nbranch's password — no password is set or returned, any you pass is\ndropped, and a ``password_notice`` is returned instead. CAVEAT:\n``password_required`` is root-only, so a SECOND writer on a ROOT branch\n(a deleted-and-recreated writer) still reports true and still gets a\ngenerated password — but the controller keeps the root's ORIGINAL one,\nso that generated password won't log in. The tool can't detect this; if\nthe database already existed, tell the user to use its original\ncloud_admin password. An older api_server that doesn't report\n``password_required`` (or a failed branch lookup) also generates, so\nthe first writer of a root is never regressed."
    },
    "connectivity_mode": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "``nlb_external`` to give the endpoint a public,\ninternet-facing address (its own load balancer) so a client outside\nthe cluster can connect. Omit for the in-cluster default. Requires\n``allowed_cidrs``."
    },
    "allowed_cidrs": {
      "anyOf": [
        {
          "items": {
            "type": "string"
          },
          "type": "array"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "source IP allow-list for ``nlb_external`` (CIDRs, each\nwith an explicit prefix, e.g. ``[\"203.0.113.4/32\"]``). REQUIRED when\n``connectivity_mode`` is ``nlb_external`` — a public endpoint with no\nallow-list is open to the whole internet behind only the password, so\nMeko rejects it, along with any entry broader than /24 (IPv4) or /48\n(IPv6), an unspecified/default network, or an IPv4-mapped IPv6 range.\nAsk the user for the IPs to allow."
    },
    "datapack_id": {
      "default": "",
      "type": "string",
      "description": "UUID of the datapack. Defaults to the active datapack."
    },
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Langfuse conversation id from stored chat; nests the trace."
    }
  },
  "required": [
    "cluster_id",
    "branch_id"
  ],
  "additionalProperties": false
}
```

## amp_compute_list

```json
{
  "type": "object",
  "properties": {
    "cluster_id": {
      "type": "string",
      "description": "UUID of the cluster. Use ``amp_cluster_list`` to find it."
    },
    "branch_id": {
      "type": "string",
      "description": "UUID of the branch. Use ``amp_branch_list`` to find it."
    },
    "datapack_id": {
      "default": "",
      "type": "string",
      "description": "UUID of the datapack. Defaults to the active datapack."
    },
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Langfuse conversation id from stored chat; nests the trace."
    }
  },
  "required": [
    "cluster_id",
    "branch_id"
  ],
  "additionalProperties": false
}
```

## amp_compute_get

```json
{
  "type": "object",
  "properties": {
    "cluster_id": {
      "type": "string",
      "description": "UUID of the cluster. Use ``amp_cluster_list`` to find it."
    },
    "branch_id": {
      "type": "string",
      "description": "UUID of the branch. Use ``amp_branch_list`` to find it."
    },
    "compute_id": {
      "type": "string",
      "description": "UUID of the compute instance. Use ``amp_compute_list`` to find it."
    },
    "datapack_id": {
      "default": "",
      "type": "string",
      "description": "UUID of the datapack. Defaults to the active datapack."
    },
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Langfuse conversation id from stored chat; nests the trace."
    }
  },
  "required": [
    "cluster_id",
    "branch_id",
    "compute_id"
  ],
  "additionalProperties": false
}
```

## amp_compute_delete

```json
{
  "type": "object",
  "properties": {
    "cluster_id": {
      "type": "string",
      "description": "UUID of the cluster. Use ``amp_cluster_list`` to find it."
    },
    "branch_id": {
      "type": "string",
      "description": "UUID of the branch. Use ``amp_branch_list`` to find it."
    },
    "compute_id": {
      "type": "string",
      "description": "UUID of the compute instance to delete. Use ``amp_compute_list``."
    },
    "datapack_id": {
      "default": "",
      "type": "string",
      "description": "UUID of the datapack. Defaults to the active datapack."
    },
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Langfuse conversation id from stored chat; nests the trace."
    }
  },
  "required": [
    "cluster_id",
    "branch_id",
    "compute_id"
  ],
  "additionalProperties": false
}
```

## amp_compute_resize

```json
{
  "type": "object",
  "properties": {
    "cluster_id": {
      "type": "string",
      "description": "UUID of the cluster. Use ``amp_cluster_list`` to find it."
    },
    "branch_id": {
      "type": "string",
      "description": "UUID of the branch. Use ``amp_branch_list`` to find it."
    },
    "compute_id": {
      "type": "string",
      "description": "UUID of the compute instance. Use ``amp_compute_list``."
    },
    "cpu": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "New CPU reservation, a Kubernetes quantity (e.g. \"2\", \"500m\")."
    },
    "memory": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "New memory reservation (e.g. \"8Gi\")."
    },
    "datapack_id": {
      "default": "",
      "type": "string",
      "description": "UUID of the datapack. Defaults to the active datapack."
    },
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Langfuse conversation id from stored chat; nests the trace."
    }
  },
  "required": [
    "cluster_id",
    "branch_id",
    "compute_id"
  ],
  "additionalProperties": false
}
```

## amp_core_budget

```json
{
  "type": "object",
  "properties": {
    "datapack_id": {
      "default": "",
      "type": "string",
      "description": "UUID of the datapack (routes the request; the budget\nitself is account-wide). Defaults to the active datapack."
    },
    "conversation_id": {
      "default": "",
      "type": "string",
      "description": "Langfuse conversation id from stored chat; nests the trace."
    }
  },
  "additionalProperties": false
}
```
