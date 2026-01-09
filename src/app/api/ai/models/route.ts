import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { apiHost, apiKey, type } = await req.json();

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

    let response;
    
    if (type === 'anthropic') {
      url = `${url}/models`;
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      console.log(`[Proxy] Fetching models from ${url} (type: ${type})`);
      response = await fetch(url, { method: 'GET', headers });

    } else if (type === 'gemini') {
       // ... Gemini logic (simplified for brevity if unchanged, but putting full logic here for safety)
       const versionPattern = /\/v\d+(?:beta)?(?:\/|$)/;
       if (!versionPattern.test(url)) {
         if (!url.endsWith('/')) { url += '/'; }
         url += 'v1beta';
       }
       if (!url.endsWith('/')) { url += '/'; }
       url += `models?key=${apiKey}`;
       console.log(`[Proxy] Fetching models from ${url} (type: ${type})`);
       response = await fetch(url, { method: 'GET', headers });

    } else {
      // OpenAI Compatible - Retry Strategy
      // 1. Try exact path + /models
      // 2. Try path + /v1/models (if not already versioned)
      
      const candidates = [];
      const cleanHost = apiHost.replace(/\/+$/, '');
      
      // Candidate 1: Direct append /models (e.g. host/models)
      candidates.push(`${cleanHost}/models`);

      // Candidate 2: Standard v1 append (e.g. host/v1/models)
      // Only add if host doesn't already have 'v1' or similar version
      const versionPattern = /\/v\d+(?:beta)?(?:\/|$)/;
      if (!versionPattern.test(cleanHost) && !cleanHost.endsWith('/v1')) {
          candidates.push(`${cleanHost}/v1/models`);
      }

      headers['Authorization'] = `Bearer ${apiKey}`;
      
      let lastError;
      
      for (const candidateUrl of candidates) {
          console.log(`[Proxy] Trying fetch models from ${candidateUrl}`);
          try {
              const res = await fetch(candidateUrl, { method: 'GET', headers });
              if (res.ok) {
                  response = res;
                  break; 
              } else {
                  const txt = await res.text();
                  lastError = `Status ${res.status}: ${txt}`;
                  console.warn(`[Proxy] Failed attempt ${candidateUrl}: ${lastError}`);
              }
          } catch (e: any) {
              lastError = e.message;
              console.warn(`[Proxy] Failed attempt ${candidateUrl}: ${lastError}`);
          }
      }

      if (!response) {
          return NextResponse.json(
             { error: `All fetch attempts failed. Last error: ${lastError}` },
             { status: 500 }
          );
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Proxy] Fetch failed: ${response.status}`, errorText);
      return NextResponse.json(
        { error: `Provider error: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    let models = [];

    // Parse response based on type
    if (type === 'gemini') {
      // { models: [ { name: 'models/chat-bison-001', ... } ] }
      models = (data.models || []).map((m: any) => ({
        modelId: m.name.replace('models/', ''),
        nickname: m.displayName || m.name,
        type: 'chat',
      }));
    } else {
      // OpenAI / Anthropic format: { data: [ { id: '...' } ] }
      // Anthropic does support this format in newer APIs? 
      // Actually Anthropic models endpoint returns { models: [...] } in some versions?
      // Checking docs: GET /v1/models -> { data: [ { id: "claude-3-5-sonnet-20240620", ... } ] } (matches OpenAI)
      const list = data.data || data.models || [];
      models = list.map((m: any) => ({
        modelId: m.id,
        nickname: m.id,
        type: 'chat',
      }));
    }

    return NextResponse.json({ models });
  } catch (error: any) {
    console.error('[Proxy] Internal Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
