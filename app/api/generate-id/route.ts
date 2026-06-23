import { NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { entity_type, country_code = '', dept_code = '' } = await req.json();

    const supabase = createRouteClient();

    const { data, error } = await supabase.rpc('generate_next_id', {
      p_entity_type: entity_type,
      p_country_code: country_code,
      p_dept_code: dept_code,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
