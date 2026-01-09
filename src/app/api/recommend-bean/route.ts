import { NextRequest, NextResponse } from 'next/server';
// Internal AI Service for Next.js
import { recommendBean } from '@/lib/services/ai';

export async function POST(req: NextRequest) {
  try {
    const { history, inventory } = await req.json();

    if (!inventory || !Array.isArray(inventory) || inventory.length === 0) {
      return NextResponse.json({ error: '库存不能为空' }, { status: 400 });
    }

    // Parse AI Config Header if present
    const aiConfigHeader = req.headers.get('x-ai-config');
    let aiConfig = null;
    if (aiConfigHeader) {
      try {
        aiConfig = JSON.parse(decodeURIComponent(aiConfigHeader));
      } catch (e) {
        console.warn('Failed to parse X-AI-Config header', e);
      }
    }

    console.log('🎲 Starting bean recommendation (Next.js Route)...');
    const recommendation = await recommendBean(history || [], inventory, aiConfig);
    
    return NextResponse.json({
      success: true,
      data: recommendation,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Recommendation failed:', error);
    return NextResponse.json({ error: '推荐生成失败: ' + error.message }, { status: 500 });
  }
}
