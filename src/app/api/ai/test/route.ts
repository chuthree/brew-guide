import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { apiHost, apiKey, type, model, testType = 'text' } = await req.json();

    if (!apiHost || !apiKey) {
      return NextResponse.json(
        { error: 'Missing apiHost or apiKey' },
        { status: 400 }
      );
    }

    let url = apiHost.replace(/\/+$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    let body = {};
    
    // 1x1 Transparent PNG
    const dummyImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    // Construct request based on type
    if (type === 'anthropic') {
      url = `${url}/v1/messages`;
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      
      const messages: any[] = [];
      
      if (testType === 'vision') {
         messages.push({
            role: 'user',
            content: [
              { type: 'text', text: 'What is this?' },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: dummyImage.split(',')[1] } }
            ]
         });
      } else if (testType === 'tools') {
         messages.push({ role: 'user', content: 'What is the weather in Tokyo?' });
         body = {
            ...body,
            tools: [{
              name: 'get_weather',
              description: 'Get weather',
              input_schema: {
                type: 'object',
                properties: { location: { type: 'string' } },
                required: ['location']
              }
            }]
         };
      } else {
         messages.push({ role: 'user', content: 'Hi' });
      }

      body = {
        ...body,
        model: model || 'claude-3-sonnet-20240229',
        max_tokens: 50,
        messages
      };
      
    } else if (type === 'gemini') {
      // Google Gemini
      const geminiModel = model || 'gemini-pro';
      url = `${url}/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
      
      let parts: any[] = [];
      if (testType === 'vision') {
        parts = [
          { text: 'Describe this image' },
          { inline_data: { mime_type: 'image/png', data: dummyImage.split(',')[1] } }
        ];
      } else if (testType === 'tools') {
        // Gemini tools format is complex, skipping for simplicity or implementing basic if needed
        // For now, Gemini tool testing might be tricky without valid function declarations structure
        // Let's defer tool test for Gemini or simulate a prompt that might trigger it if supported
         parts = [{ text: 'What is the weather in Tokyo?' }];
         // Add tool config if feasible
      } else {
        parts = [{ text: 'Hi' }];
      }
      
      body = {
        contents: [{ role: 'user', parts }]
      };
      
    } else {
      // Default to OpenAI compatible
      const versionPattern = /\/v\d+(?:beta)?(?:\/|$)/;
      if (!versionPattern.test(url)) {
        if (!url.endsWith('/')) {
          url += '/';
        }
        url += 'v1';
      }
      
      if (!url.endsWith('/')) {
        url += '/';
      }
      url += 'chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      
      const messages: any[] = [];
      
      if (testType === 'vision') {
        messages.push({
          role: 'user',
          content: [
             { type: 'text', text: 'What color is in this image?' },
             { type: 'image_url', image_url: { url: dummyImage } }
          ]
        });
      } else if (testType === 'tools') {
        messages.push({ role: 'user', content: 'What is the weather in San Francisco?' });
        body = {
           ...body,
           tools: [{
             type: 'function',
             function: {
               name: 'get_weather',
               description: 'Get the weather',
               parameters: {
                 type: 'object',
                 properties: { location: { type: 'string', description: 'City name' } },
                 required: ['location']
               }
             }
           }],
           tool_choice: 'auto'
        };
      } else {
         messages.push({ role: 'user', content: 'Hi' });
      }

      body = {
        ...body,
        model: model || 'gpt-3.5-turbo',
        messages,
        max_tokens: 50
      };
    }

    console.log(`[Proxy] Testing ${testType} connection to ${url} (type: ${type})`);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Proxy] Test failed: ${response.status}`, errorText);
      return NextResponse.json(
        { error: `Provider error: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Validate Tool Use Response
    if (testType === 'tools') {
       let hasToolCall = false;
       if (type === 'anthropic' && data.content?.some((c:any) => c.type === 'tool_use')) hasToolCall = true;
       if (type !== 'anthropic' && type !== 'gemini' && data.choices?.[0]?.message?.tool_calls?.length > 0) hasToolCall = true;
       
       if (!hasToolCall) {
          // It's not necessarily an error if model refuses, but for "supported" check it is failed
          // check if model returns text saying it can't
       }
       return NextResponse.json({ success: true, data, hasToolCall });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('[Proxy] Internal Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
