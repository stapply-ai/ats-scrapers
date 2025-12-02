import type { JobMarker } from '@/types';
import { buildDataContext } from '@/utils/data-queries';
import { mapControlFunctions, mapControlFunctionDefinitions, type MapControlCallbacks, type ViewState } from '@/utils/map-control';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | null;
    tool_call_id?: string;
    tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
            name: string;
            arguments: string;
        };
    }>;
}

export interface FunctionCall {
    name: string;
    arguments: Record<string, any>;
}

export interface FunctionCallResult {
    name: string;
    result: any;
}

const API_CHAT_URL = '/api/chat';

/**
 * Call Mistral AI API via secure serverless function
 */
async function callMistralAPI(
    messages: ChatMessage[],
    tools?: any[],
    toolChoice: 'auto' | 'none' = 'auto'
): Promise<{
    content: string;
    functionCalls?: FunctionCall[];
    toolCalls?: Array<{
        id: string;
        type: 'function';
        function: {
            name: string;
            arguments: string;
        };
    }>;
}> {

    // Prepare messages for API (Mistral supports system, user, assistant, tool roles)
    const apiMessages = messages.map(msg => {
        const message: any = {
            role: msg.role,
        };

        // Extract content string from various formats
        let contentValue: string | null = null;
        if (msg.content) {
            if (typeof msg.content === 'string') {
                contentValue = msg.content.trim() || null;
            } else if (Array.isArray(msg.content)) {
                const contentArray = msg.content as any[];
                contentValue = contentArray
                    .map((block: any) => {
                        if (typeof block === 'string') return block;
                        if (block && typeof block === 'object') {
                            return block.text || block.content || '';
                        }
                        return '';
                    })
                    .join('')
                    .trim() || null;
            } else if (typeof msg.content === 'object' && msg.content !== null) {
                contentValue = ((msg.content as any).text || (msg.content as any).content || '').trim() || null;
            }
        }

        // For assistant messages, content can be empty if tool_calls are present
        // But Mistral requires at least one of content or tool_calls to be non-empty
        if (msg.role === 'assistant') {
            if (msg.tool_calls && msg.tool_calls.length > 0) {
                message.tool_calls = msg.tool_calls;
                // Content can be null or empty string when tool_calls are present
                // Use null instead of empty string to be explicit
                message.content = contentValue;
            } else {
                // If no tool_calls, content must be non-empty
                message.content = contentValue || '';
            }
        } else {
            message.content = contentValue || '';
        }

        if (msg.role === 'tool') {
            if (msg.tool_call_id) {
                message.tool_call_id = msg.tool_call_id;
            }
            // Tool messages don't need name, they use tool_call_id
        }
        return message;
    });

    // Call our secure API route (which proxies to Mistral)
    const response = await fetch(API_CHAT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messages: apiMessages,
            tools: tools && tools.length > 0 ? tools : undefined,
            tool_choice: toolChoice === 'auto' ? 'auto' : 'none',
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`API error: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }

    const data = await response.json();
    const choice = data.choices[0];

    if (!choice) {
        throw new Error('No response from Mistral API');
    }

    const message = choice.message;
    const functionCalls: FunctionCall[] = [];
    const toolCallsForHistory: Array<{
        id: string;
        type: 'function';
        function: {
            name: string;
            arguments: string;
        };
    }> = [];

    // Handle function calls (Mistral uses tool_calls)
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
        for (const toolCall of message.tool_calls) {
            if (toolCall.function) {
                functionCalls.push({
                    name: toolCall.function.name,
                    arguments: JSON.parse(toolCall.function.arguments || '{}'),
                });
                // Store tool call structure for conversation history
                toolCallsForHistory.push({
                    id: toolCall.id,
                    type: 'function',
                    function: {
                        name: toolCall.function.name,
                        arguments: toolCall.function.arguments || '{}',
                    },
                });
            }
        }
    }

    // Extract content - handle both string and array formats
    let contentText = '';
    if (message.content) {
        if (typeof message.content === 'string') {
            contentText = message.content;
        } else if (Array.isArray(message.content)) {
            // Mistral may return content as array of content blocks
            contentText = message.content
                .map((block: any) => {
                    if (typeof block === 'string') {
                        return block;
                    } else if (block && typeof block === 'object') {
                        // Handle {type: 'text', text: '...'} format
                        return block.text || block.content || '';
                    }
                    return '';
                })
                .join('');
        } else if (typeof message.content === 'object' && message.content !== null) {
            // Handle single object format {type: 'text', text: '...'}
            contentText = (message.content as any).text || (message.content as any).content || '';
        }
    }

    return {
        content: contentText,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
        toolCalls: toolCallsForHistory.length > 0 ? toolCallsForHistory : undefined,
    };
}

/**
 * Execute function calls and return results
 */
function executeFunctionCalls(
    functionCalls: FunctionCall[],
    allJobs: JobMarker[],
    callbacks: MapControlCallbacks
): FunctionCallResult[] {
    const results: FunctionCallResult[] = [];

    for (const funcCall of functionCalls) {
        try {
            let result: any;

            switch (funcCall.name) {
                case 'flyToLocation':
                    result = mapControlFunctions.flyToLocation(
                        funcCall.arguments.location,
                        allJobs,
                        callbacks,
                        funcCall.arguments.zoom
                    );
                    break;

                case 'setZoom':
                    result = mapControlFunctions.setZoom(
                        funcCall.arguments.zoom,
                        callbacks
                    );
                    break;

                case 'filterJobsByLocation':
                    result = mapControlFunctions.filterJobsByLocation(
                        funcCall.arguments.location,
                        allJobs,
                        callbacks
                    );
                    break;

                case 'filterJobsByCompany':
                    result = mapControlFunctions.filterJobsByCompany(
                        funcCall.arguments.company,
                        allJobs,
                        callbacks
                    );
                    break;

                case 'filterJobsByTitle':
                    result = mapControlFunctions.filterJobsByTitle(
                        funcCall.arguments.titleQuery,
                        allJobs,
                        callbacks,
                        funcCall.arguments.location
                    );
                    break;

                case 'resetFilters':
                    result = mapControlFunctions.resetFilters(callbacks);
                    break;

                case 'getLocationStats':
                    result = mapControlFunctions.getLocationStats(
                        funcCall.arguments.location,
                        allJobs
                    );
                    break;

                case 'allAvailableCompanies':
                    result = mapControlFunctions.allAvailableCompanies(
                        allJobs,
                        funcCall.arguments.page,
                        funcCall.arguments.pageSize
                    );
                    break;

                case 'allAvailableLocations':
                    result = mapControlFunctions.allAvailableLocations(
                        allJobs,
                        funcCall.arguments.page,
                        funcCall.arguments.pageSize
                    );
                    break;

                case 'allAvailableTitles':
                    result = mapControlFunctions.allAvailableTitles(
                        allJobs,
                        funcCall.arguments.page,
                        funcCall.arguments.pageSize
                    );
                    break;

                default:
                    result = {
                        success: false,
                        message: `Unknown function: ${funcCall.name}`,
                    };
            }

            results.push({
                name: funcCall.name,
                result,
            });
        } catch (error) {
            results.push({
                name: funcCall.name,
                result: {
                    success: false,
                    message: `Error executing ${funcCall.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
            });
        }
    }

    return results;
}

/**
 * Build system prompt with data context
 */
function buildSystemPrompt(
    jobs: JobMarker[],
    viewState?: ViewState
): string {
    const context = buildDataContext(jobs, viewState);

    const spreadInfo = context.geographicSpread.isScattered
        ? `\n\nIMPORTANT: The job locations are ${context.geographicSpread.spreadDescription}. When showing filtered results or navigating to locations, you should set an appropriate zoom level to show the full geographic spread. For scattered locations, use a high-level view (zoom level ${context.geographicSpread.recommendedZoom} or lower) to ensure all locations are visible. Only zoom in closer when the user specifically requests to see a particular location in detail.`
        : `\n\nThe job locations are ${context.geographicSpread.spreadDescription}. Use zoom level ${context.geographicSpread.recommendedZoom} or appropriate level based on the geographic spread when showing results.`;

    return `You are an AI assistant helping users explore job data on an interactive map. You have access to ${context.totalJobs} jobs across ${context.uniqueLocations} locations and ${context.uniqueCompanies} companies.

Your capabilities:
1. Answer questions about job statistics, locations, companies, and trends
2. Control the map to navigate to locations, zoom in/out, and filter jobs
3. Filter jobs by title/keywords (e.g., "tech internships", "software engineer", "data scientist") and optionally by location
4. Provide insights about the job market based on the data

Current data overview:
- Total jobs: ${context.totalJobs}
- Unique locations: ${context.uniqueLocations}
- Unique companies: ${context.uniqueCompanies}
- Top locations: ${context.topLocations.slice(0, 5).map(l => `${l.location} (${l.jobCount} jobs)`).join(', ')}
- Top companies: ${context.topCompanies.slice(0, 5).map(c => `${c.company} (${c.jobCount} jobs)`).join(', ')}
- Geographic spread: ${context.geographicSpread.spreadDescription}${spreadInfo}

Map navigation guidelines:
- When locations are scattered across large distances (multiple continents or very wide regions), always use a high-level view (zoom 1-3) to show the full geographic distribution
- When showing filtered results that span multiple regions, use zoom level ${context.geographicSpread.recommendedZoom} or lower to ensure all matching locations are visible
- Only zoom in closer (zoom 6+) when the user specifically requests detail for a particular city or region
- When filtering jobs, if the results are geographically scattered, automatically set an appropriate zoom level to show all results
- Use flyToLocation with appropriate zoom levels: zoom 1-2 for world/continental views, zoom 3-4 for regional views, zoom 6-8 for country/state views, zoom 10+ for city views

When users ask to see a location or filter jobs, use the appropriate functions to control the map. Be helpful, concise, and informative.`;
}

export class AIService {
    private conversationHistory: ChatMessage[] = [];
    private allJobs: JobMarker[] = [];
    private callbacks: MapControlCallbacks | null = null;
    private viewState: ViewState | null = null;

    /**
     * Initialize the AI service with job data and callbacks
     */
    initialize(
        jobs: JobMarker[],
        callbacks: MapControlCallbacks,
        viewState?: ViewState
    ) {
        this.allJobs = jobs;
        this.callbacks = callbacks;
        this.viewState = viewState || null;

        // Initialize with system prompt
        this.conversationHistory = [
            {
                role: 'system',
                content: buildSystemPrompt(jobs, viewState),
            },
        ];
    }

    /**
     * Update view state
     */
    updateViewState(viewState: ViewState) {
        this.viewState = viewState;
        // Update system message with new context
        if (this.conversationHistory.length > 0 && this.conversationHistory[0].role === 'system') {
            this.conversationHistory[0].content = buildSystemPrompt(this.allJobs, viewState);
        }
    }

    /**
     * Update jobs data
     */
    updateJobs(jobs: JobMarker[]) {
        this.allJobs = jobs;
        // Update system message with new context
        if (this.conversationHistory.length > 0 && this.conversationHistory[0].role === 'system') {
            this.conversationHistory[0].content = buildSystemPrompt(jobs, this.viewState || undefined);
        }
    }

    /**
     * Send a message and get AI response
     */
    async sendMessage(userMessage: string): Promise<{
        response: string;
        functionCalls?: FunctionCallResult[];
    }> {
        if (!this.callbacks) {
            throw new Error('AI service not initialized');
        }

        // Add user message
        this.conversationHistory.push({
            role: 'user',
            content: userMessage,
        });

        try {
            // Call Mistral API with function definitions
            const mistralResponse = await callMistralAPI(
                this.conversationHistory,
                mapControlFunctionDefinitions.map(def => ({
                    type: 'function',
                    function: def,
                })),
                'auto'
            );

            // Execute function calls if any
            let functionResults: FunctionCallResult[] | undefined;
            if (mistralResponse.functionCalls && mistralResponse.functionCalls.length > 0) {
                functionResults = executeFunctionCalls(
                    mistralResponse.functionCalls,
                    this.allJobs,
                    this.callbacks
                );

                // Add assistant message with tool_calls (required by Mistral API)
                // When tool_calls are present, content can be null but tool_calls must be included
                if (mistralResponse.toolCalls && mistralResponse.toolCalls.length > 0) {
                    // Ensure content is a string or null
                    const toolCallContent = typeof mistralResponse.content === 'string'
                        ? (mistralResponse.content.trim() || null)
                        : null;

                    this.conversationHistory.push({
                        role: 'assistant',
                        content: toolCallContent,
                        tool_calls: mistralResponse.toolCalls,
                    });

                    // Add function results as tool messages (Mistral format)
                    // Each tool message needs tool_call_id matching the tool call id
                    const toolMessages = mistralResponse.functionCalls!.map((funcCall, index) => {
                        const toolCall = mistralResponse.toolCalls?.[index];
                        if (!toolCall) {
                            throw new Error(`Missing tool call for function ${funcCall.name} at index ${index}`);
                        }
                        return {
                            role: 'tool' as const,
                            content: JSON.stringify(functionResults?.[index]?.result ?? {}),
                            tool_call_id: toolCall.id,
                        };
                    });

                    this.conversationHistory.push(...toolMessages);
                } else {
                    // Fallback: if no tool_calls structure, just add content
                    const fallbackContent = typeof mistralResponse.content === 'string'
                        ? mistralResponse.content
                        : '';
                    this.conversationHistory.push({
                        role: 'assistant',
                        content: fallbackContent,
                    });
                }

                // Get final response from LLM with function results
                const finalResponse = await callMistralAPI(
                    this.conversationHistory,
                    mapControlFunctionDefinitions.map(def => ({
                        type: 'function',
                        function: def,
                    })),
                    'none' // Don't call functions again, just respond
                );

                // Ensure content is a string
                const finalContent = typeof finalResponse.content === 'string'
                    ? finalResponse.content
                    : '';

                // Update conversation with final response
                this.conversationHistory.push({
                    role: 'assistant',
                    content: finalContent || '',
                });

                return {
                    response: finalContent,
                    functionCalls: functionResults,
                };
            } else {
                // No function calls, just return the response
                // Ensure content is a string
                const responseContent = typeof mistralResponse.content === 'string'
                    ? mistralResponse.content
                    : '';

                this.conversationHistory.push({
                    role: 'assistant',
                    content: responseContent,
                });

                return {
                    response: responseContent,
                };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            this.conversationHistory.push({
                role: 'assistant',
                content: `I apologize, but I encountered an error: ${errorMessage}`,
            });

            throw error;
        }
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [
            {
                role: 'system',
                content: buildSystemPrompt(this.allJobs, this.viewState || undefined),
            },
        ];
    }

    /**
     * Get conversation history
     */
    getHistory(): ChatMessage[] {
        return this.conversationHistory.filter(msg => msg.role !== 'system');
    }
}

